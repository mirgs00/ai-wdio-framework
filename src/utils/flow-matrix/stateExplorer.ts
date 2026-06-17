import { remote } from 'webdriverio'
import {
  FlowMatrix,
  FlowMatrixConfig,
  DEFAULT_FLOW_CONFIG,
  InteractiveElement,
  Interaction,
  StateNode,
  StateTransition,
} from './types'
import { computeFingerprint, classifyPageType } from './stateFingerprint'
import {
  BrowserContext,
  clickElement,
  safeNavigate,
  dismissOverlays,
  fillForm,
  generateFormData,
  sanitizeDescription,
  friendlySelector,
} from './interactionEngine'
import { MCPBrowserContext } from './mcpBrowserContext'
import type { LLMProvider } from '../ai/types'
import { logger } from '../logger'

export interface ExploreResult {
  matrix: FlowMatrix
  log: string[]
}

async function ensureBrowser(): Promise<BrowserContext> {
  // Try MCP browser context first
  try {
    const mcpCtx = new MCPBrowserContext();
    // Give it a moment to check availability
    await new Promise(resolve => setTimeout(resolve, 100));
    if (mcpCtx.isMCPAvailable()) {
      logger.info('Using MCP-backed browser context');
      return mcpCtx;
    }
  } catch {
    logger.debug('MCP browser context not available, falling back to WebDriverIO');
  }

  // Fallback to raw WebDriverIO
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const browser: any = await remote({
    capabilities: {
      browserName: process.env.BROWSER || 'chrome',
      'wdio:enforceWebDriverClassic': true,
    },
    logLevel: 'warn' as const,
  })

  const ctx: BrowserContext = {
    url: async (u: string) => browser.url(u),
    execute: async (fn: (...args: unknown[]) => unknown, ...args: unknown[]) =>
      browser.execute(fn, ...args),
    $: async (selector: string) => browser.$(selector),
    keys: async (keys: string | string[]) => browser.keys(keys),
    getUrl: async () => browser.getUrl(),
    getTitle: async () => browser.getTitle(),
    waitUntil: async (
      condition: () => Promise<boolean>,
      opts?: { timeout?: number; timeoutMsg?: string }
    ) => browser.waitUntil(condition, opts),
    pause: async (ms: number) => browser.pause(ms),
    closeSession: async () => browser.deleteSession(),
    $$: async (selector: string) => browser.$$(selector),
  }

  return ctx
}

export async function explorePage(
  url: string,
  llmProvider: LLMProvider,
  config: FlowMatrixConfig = DEFAULT_FLOW_CONFIG
): Promise<ExploreResult> {
  const matrix: FlowMatrix = {
    rootUrl: url,
    states: new Map(),
    transitions: [],
    startStateId: '',
  }
  const log: string[] = []
  const queue: string[] = []
  const visited = new Set<string>()
  const startTime = Date.now()

  log.push(`Starting exploration of: ${url}`)

  let ctx = await ensureBrowser()

  async function recoverSession(): Promise<void> {
    try {
      await ctx.closeSession()
    } catch {
      // old session already gone
    }
    ctx = await ensureBrowser()
  }

  function isSessionError(err: unknown): boolean {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
    return (
      msg.includes('invalid session') ||
      msg.includes('session') ||
      msg.includes('no such session') ||
      msg.includes('econnrefused') ||
      msg.includes('econnreset')
    )
  }

  try {
    await safeNavigate(ctx, url)
    const initial = await captureState(ctx, url)
    matrix.startStateId = initial.id
    matrix.states.set(initial.id, initial)
    visited.add(initial.fingerprint)
    queue.push(initial.id)
    log.push(
      `Initial state: ${initial.id} (${initial.url}, type: ${initial.pageType})`
    )

    while (queue.length > 0 && matrix.states.size <= config.maxStates) {
      if (Date.now() - startTime > config.totalTimeoutMs) {
        log.push('Total timeout reached, stopping exploration')
        break
      }

      const stateId = queue.shift()!
      const state = matrix.states.get(stateId)
      if (!state) continue

      const depth = getStateDepth(matrix, stateId)
      if (depth >= config.maxDepth) {
        log.push(`Skipping ${stateId}: max depth (${config.maxDepth}) reached`)
        continue
      }

      log.push(
        `Exploring state: ${stateId} (depth ${depth}, ${state.elements.length} elements)`
      )

      const interactions = selectInteractions(state)
      const selected = interactions.slice(0, config.maxInteractionsPerState)
      log.push(`  Selected ${selected.length} interactions`)

      for (let i = 0; i < selected.length; i++) {
        if (Date.now() - startTime > config.totalTimeoutMs) break
        if (matrix.states.size >= config.maxStates) break

        const interaction = selected[i]

        try {
          const result = await executeInteraction(
            ctx,
            interaction,
            state,
            llmProvider
          )
          if (result) {
            const { newNode, transition } = result
            if (!matrix.states.has(newNode.id)) {
              matrix.states.set(newNode.id, newNode)
              if (!visited.has(newNode.fingerprint)) {
                visited.add(newNode.fingerprint)
                queue.push(newNode.id)
                log.push(
                  `  → New state: ${newNode.id} (${newNode.url}, type: ${newNode.pageType})`
                )
              }
            }
            matrix.transitions.push(transition)
          }

          // Navigate back to parent state for the next interaction
          // For SPA forms: re-apply radio/checkbox selections instead of navigating back
          if (i < selected.length - 1) {
            const currentUrl = await ctx.getUrl()
            if (currentUrl === state.url) {
              // SPA form — re-apply checked radios/checkboxes from parent state
              await restoreFormState(ctx, state)
            } else {
              // Regular navigation — navigate back
              await safeNavigate(ctx, state.url)
            }
          }
        } catch (err) {
          const errMsg = (err as Error).message
          log.push(
            `  ✗ Interaction failed: ${interaction.description} — ${errMsg}`
          )

          if (isSessionError(err)) {
            log.push('  ♻️ Session error detected, recreating browser...')
            try {
              await recoverSession()
            } catch {
              log.push('  ✗ Session recovery failed, skipping remaining interactions')
              break
            }
          }

          try {
            await safeNavigate(ctx, state.url)
          } catch {
            log.push('  ✗ Navigation back failed after session recovery')
          }
        }
      }
    }
  } finally {
    await ctx.closeSession()
  }

  log.push(
    `Exploration complete: ${matrix.states.size} states, ${matrix.transitions.length} transitions`
  )

  return { matrix, log }
}

async function captureState(
  ctx: BrowserContext,
  _url: string
): Promise<StateNode> {
  await dismissOverlays(ctx)
  const currentUrl = await ctx.getUrl()
  const title = await ctx.getTitle()

  const elements = await scanInteractiveElements(ctx)

  const pageType = classifyPageType(elements, currentUrl, title)
  const fingerprint = computeFingerprint(currentUrl, pageType, elements)
  const id = fingerprint

  return { id, url: currentUrl, title, pageType, fingerprint, elements }
}

async function scanInteractiveElements(
  ctx: BrowserContext
): Promise<InteractiveElement[]> {
  const raw = await ctx.execute(() => {
    const results: Array<{
      tag: string
      selector: string
      type?: string
      name?: string
      placeholder?: string
      text?: string
      attributes: Record<string, string>
    }> = []

    function getSelector(el: Element): string {
      // 1. id (perfect, unique)
      if (el.id) return `#${CSS.escape(el.id)}`

      // 2. data-test / data-testid (standard testing attributes)
      const testAttr = el.getAttribute('data-test') || el.getAttribute('data-testid')
      if (testAttr) return `[data-test="${CSS.escape(testAttr)}"]`

      // 3. data-qa (custom QA attribute)
      const qa = el.getAttribute('data-qa')
      if (qa) return `[data-qa="${CSS.escape(qa)}"]`

      // 4. aria-label (accessibility attribute)
      const ariaLabel = el.getAttribute('aria-label')
      if (ariaLabel) return `[aria-label="${CSS.escape(ariaLabel)}"]`

      // 5. name (common for form elements)
      const name = el.getAttribute('name')
      if (name) return `${el.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`

      // 6. title attribute
      const title = el.getAttribute('title')
      if (title) return `${el.tagName.toLowerCase()}[title="${CSS.escape(title)}"]`

      // 7. href for anchor links (skip external/javascript anchors)
      if (el.tagName === 'A') {
        const href = el.getAttribute('href')
        if (href && !href.startsWith('http') && !href.startsWith('//') && !href.startsWith('javascript:')) {
          return `a[href="${CSS.escape(href)}"]`
        }
      }

      // 8. Unique class chain
      const classList = (el as HTMLElement).classList
      if (classList && classList.length > 0) {
        const clsSel = Array.from(classList).map(c => `.${CSS.escape(c)}`).join('')
        if (document.querySelectorAll(clsSel).length === 1) return clsSel
      }

      // 9. Attribute combination for inputs
      if (el instanceof HTMLInputElement) {
        const inputType = el.getAttribute('type')
        const inputName = el.getAttribute('name')
        if (inputType && inputName) return `input[type="${CSS.escape(inputType)}"][name="${CSS.escape(inputName)}"]`
        if (inputType) return `input[type="${CSS.escape(inputType)}"]`
      }

      // 10. nth-child with best-possible parent selector (last resort)
      const parent = el.parentElement
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (c) => c.tagName === el.tagName
        )
        const idx = siblings.indexOf(el) + 1
        const parentSel = getSelector(parent)
        return `${parentSel} > ${el.tagName.toLowerCase()}:nth-child(${idx})`
      }

      return el.tagName.toLowerCase()
    }

    const tags = ['a', 'button', 'input', 'select', 'textarea', 'form']
    const roleSelectors = ['[role="button"]', '[role="radio"]', '[role="checkbox"]', '[role="combobox"]', '[role="tab"]', '[role="menuitem"]']
    const seen = new Set<string>()

    for (const tag of tags) {
      const els = document.querySelectorAll(tag) as unknown as HTMLElement[]
      for (const el of els) {
        if (el instanceof HTMLElement && el.offsetParent === null) continue
        if (el instanceof HTMLElement && el.style.display === 'none') continue

        // Skip hidden inputs early
        if (tag === 'input' && (el as HTMLInputElement).type === 'hidden') continue

        const selector = getSelector(el)

        if (seen.has(selector)) continue
        seen.add(selector)

        const attrs: Record<string, string> = {}
        for (let i = 0; i < el.attributes.length; i++) {
          const attr = el.attributes[i]
          attrs[attr.name] = attr.value
        }

        let type: string | undefined
        let name: string | undefined
        let placeholder: string | undefined
        let text: string | undefined

        if (el instanceof HTMLInputElement) {
          type = el.type
          name = el.name
          placeholder = el.placeholder
          // Capture checked state for radios/checkboxes
          if (el.type === 'radio' || el.type === 'checkbox') {
            attrs['checked'] = String(el.checked)
          }
        } else if (
          el instanceof HTMLSelectElement ||
          el instanceof HTMLTextAreaElement
        ) {
          name = el.name
          placeholder = (el as HTMLTextAreaElement).placeholder
          if (el instanceof HTMLSelectElement) {
            attrs['_selectOptions'] = JSON.stringify(
              Array.from(el.options).map((o) => o.value || o.text).filter(Boolean)
            )
          }
        } else if (el instanceof HTMLButtonElement) {
          type = el.type
          name = el.name
          text = (el.textContent || '').trim().slice(0, 100)
        } else if (el instanceof HTMLElement) {
          text = (el.textContent || '').trim().slice(0, 100)
        }

        results.push({
          tag: el.tagName.toLowerCase(),
          selector,
          type,
          name,
          placeholder,
          text,
          attributes: attrs,
        })
      }
    }

    // Scan role-based interactive elements (custom components, ARIA widgets)
    for (const selector of roleSelectors) {
      const els = document.querySelectorAll(selector) as unknown as HTMLElement[]
      for (const el of els) {
        if (el instanceof HTMLElement && el.offsetParent === null) continue
        if (el instanceof HTMLElement && el.style.display === 'none') continue

        const sel = getSelector(el)
        if (seen.has(sel)) continue
        seen.add(sel)

        const attrs: Record<string, string> = {}
        for (let i = 0; i < el.attributes.length; i++) {
          const attr = el.attributes[i]
          attrs[attr.name] = attr.value
        }
        attrs['role'] = el.getAttribute('role') || ''

        const roleElType = el.getAttribute('role') || ''

        results.push({
          tag: el.tagName.toLowerCase(),
          selector: sel,
          type: roleElType || undefined,
          name: el.getAttribute('aria-label') || undefined,
          text: (el.textContent || '').trim().slice(0, 100),
          attributes: attrs,
        })
      }
    }

    // Scan elements inside iframes (same-origin only)
    const iframes = Array.from(document.querySelectorAll('iframe'))
    for (const iframe of iframes) {
      let iframeDoc: Document | null = null
      try {
        iframeDoc = (iframe as HTMLIFrameElement).contentDocument
      } catch {
        continue // cross-origin iframe — skip
      }
      if (!iframeDoc) continue

      for (const tag of tags) {
        const els = iframeDoc.querySelectorAll(tag) as unknown as HTMLElement[]
        for (const el of els) {
          if (el instanceof HTMLElement && el.offsetParent === null) continue
          if (el instanceof HTMLElement && el.style.display === 'none') continue
          if (tag === 'input' && (el as HTMLInputElement).type === 'hidden') continue

          const selector = getSelector(el)
          if (seen.has(selector)) continue
          seen.add(selector)

          const attrs: Record<string, string> = {}
          for (let i = 0; i < el.attributes.length; i++) {
            const attr = el.attributes[i]
            attrs[attr.name] = attr.value
          }

          let type: string | undefined
          let name: string | undefined
          let placeholder: string | undefined
          let text: string | undefined

          if (el instanceof HTMLInputElement) {
            type = el.type
            name = el.name
            placeholder = el.placeholder
            // Capture checked state for radios/checkboxes
            if (el.type === 'radio' || el.type === 'checkbox') {
              attrs['checked'] = String(el.checked)
            }
          } else if (el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
            name = el.name
            placeholder = (el as HTMLTextAreaElement).placeholder
            if (el instanceof HTMLSelectElement) {
              attrs['_selectOptions'] = JSON.stringify(
                Array.from(el.options).map((o) => o.value || o.text).filter(Boolean)
              )
            }
          } else if (el instanceof HTMLElement) {
            text = (el.textContent || '').trim().slice(0, 100)
          }

          results.push({
            tag: el.tagName.toLowerCase(),
            selector,
            type,
            name,
            placeholder,
            text,
            attributes: attrs,
          })
        }
      }
    }

    return results
  })

  return raw.map((r) => ({
    tag: r.tag,
    selector: r.selector,
    type: r.type,
    name: r.name,
    placeholder: r.placeholder,
    text: r.text,
    attributes: r.attributes,
    isButton:
      r.tag === 'button' ||
      (r.tag === 'input' && r.type === 'submit') ||
      (r.tag === 'input' && r.type === 'button'),
    isLink: r.tag === 'a',
    isInput: r.tag === 'input' || r.tag === 'textarea' || r.tag === 'select',
    isForm: r.tag === 'form',
    isSelect: r.tag === 'select',
  }))
}

function selectInteractions(state: StateNode): Interaction[] {
  const high: Interaction[] = []
  const medium: Interaction[] = []
  const low: Interaction[] = []

  const downloadExtensions = ['.pdf', '.zip', '.exe', '.dmg', '.iso', '.tar', '.gz']

  function isOffSiteLink(el: InteractiveElement): boolean {
    const href = el.attributes['href']
    if (!href) return false
    if (href.startsWith('http://') || href.startsWith('https://')) {
      try {
        const linkHost = new URL(href).hostname
        const currentHost = new URL(state.url).hostname
        return linkHost !== currentHost
      } catch {
        return true
      }
    }
    return false
  }

  function isDownloadLink(el: InteractiveElement): boolean {
    if (el.attributes['download'] !== undefined) return true
    const href = (el.attributes['href'] || '').toLowerCase()
    return downloadExtensions.some((ext) => href.endsWith(ext))
  }

  for (const el of state.elements) {
    // Form submits: top priority — fills form + clicks submit
    if (el.isForm || (el.isInput && el.type === 'submit') || (el.isButton && el.type === 'submit')) {
      high.push({
        type: 'submit',
        selector: el.isForm ? el.selector : 'form',
        description: `Submit form`,
      })
      continue
    }

    // Text-like inputs: fillable fields
    if (
      el.isInput &&
      el.type &&
      ['text', 'search', 'email', 'url', 'tel', 'number'].includes(el.type)
    ) {
      high.push({
        type: 'setValue',
        selector: el.selector,
        description: `Fill "${el.name || el.placeholder || el.selector}"`,
      })
      continue
    }

    // Radio buttons: click to select
    if (el.isInput && el.type === 'radio') {
      const value = el.attributes['value']
      const selectorLabel = el.selector.replace(/^#/, '')
      const label = sanitizeDescription(value || selectorLabel || el.name || '') || friendlySelector(el.selector)
      medium.push({
        type: 'click',
        selector: el.selector,
        description: `Click "${label}"`,
      })
      continue
    }

    // Checkboxes: click to toggle
    if (el.isInput && el.type === 'checkbox') {
      medium.push({
        type: 'click',
        selector: el.selector,
        description: `Click "${el.name || el.selector}"`,
      })
      continue
    }

    // Plain buttons (not submit-type)
    if (el.isButton) {
      const label = sanitizeDescription(el.text || el.name || '')
      medium.push({
        type: 'click',
        selector: el.selector,
        description: `Click "${label || friendlySelector(el.selector)}"`,
      })
      continue
    }

    // Links: lowest priority — skip off-site, skip downloads
    if (el.isLink) {
      if (isOffSiteLink(el)) continue
      if (isDownloadLink(el)) continue
      const hrefPath = (el.attributes['href'] || '').replace(/^https?:\/\/[^/]+/i, '').replace(/[?#/]/g, ' ').trim() || 'home'
      const label = sanitizeDescription(el.text || '') ||
        sanitizeDescription(el.attributes['aria-label'] || '') ||
        sanitizeDescription(el.attributes['title'] || '') ||
        hrefPath ||
        friendlySelector(el.selector)
      low.push({
        type: 'click',
        selector: el.selector,
        description: `Click "${label}"`,
      })
      continue
    }
  }

  // Limit each tier so no single category dominates (max 20 total, max 8 per tier)
  const maxPerTier = 8
  const maxTotal = 20
  const result = [
    ...high.slice(0, maxPerTier),
    ...medium.slice(0, maxPerTier),
    ...low.slice(0, maxPerTier),
  ]
  return result.slice(0, maxTotal)
}

/**
 * Restore form state by re-clicking checked radios/checkboxes.
 * Used after SPA interactions to re-apply parent state's selections.
 */
async function restoreFormState(ctx: BrowserContext, state: StateNode): Promise<void> {
  const checkedElements = state.elements.filter(
    (el) => el.isInput && (el.type === 'radio' || el.type === 'checkbox') && el.attributes['checked'] === 'true'
  )
  for (const el of checkedElements) {
    try {
      const browserEl = await ctx.$(el.selector)
      if (browserEl) {
        await browserEl.click()
        await ctx.pause(300)
      }
    } catch {
      // Element might not be visible after state change — skip
    }
  }
}

async function executeInteraction(
  ctx: BrowserContext,
  interaction: Interaction,
  state: StateNode,
  llmProvider: LLMProvider
): Promise<{ newNode: StateNode; transition: StateTransition } | null> {
  const fromId = state.id

  if (interaction.type === 'click') {
    await clickElement(ctx, interaction.selector)
  } else if (interaction.type === 'submit') {
    const formElements = state.elements.filter(
      (el) =>
        el.isInput &&
        el.type !== 'submit' &&
        el.type !== 'button' &&
        el.type !== 'hidden' &&
        el.type !== 'checkbox' &&
        el.type !== 'radio'
    )
    const formData = await generateFormData(formElements, llmProvider)
    await fillForm(ctx, formElements, formData)

    const submitBtn = state.elements.find(
      (el) => el.isInput && el.type === 'submit'
    ) || state.elements.find(
      (el) => el.isButton && el.type === 'submit'
    )
    if (submitBtn) {
      await clickElement(ctx, submitBtn.selector)
    } else {
      await ctx.keys(['Enter'])
    }
    interaction.data = formData
  } else if (interaction.type === 'setValue') {
    const inputEl = state.elements.find(
      (el) => el.selector === interaction.selector
    )
    if (inputEl) {
      const formData = await generateFormData([inputEl], llmProvider)
      await fillForm(ctx, [inputEl], formData)
      interaction.data = formData
    }
  }

  const urlBefore = await ctx.getUrl()

  try {
    await ctx.waitUntil(
      async () => (await ctx.execute(() => document.readyState)) === 'complete',
      { timeout: 10000, timeoutMsg: 'Page did not load after interaction' }
    )
  } catch {
    // continue even if timeout
  }

  const currentUrl = await ctx.getUrl()

  // SPA handling: if URL hasn't changed, wait for DOM mutations to settle
  if (currentUrl === urlBefore) {
    try {
      await ctx.execute(() => {
        return new Promise<void>((resolve) => {
          let lastMutationTime = Date.now()
          let hasMutations = false
          const maxWait = 5000

          const observer = new MutationObserver(() => {
            hasMutations = true
            lastMutationTime = Date.now()
          })
          observer.observe(document.body, { childList: true, subtree: true, attributes: true })

          const check = setInterval(() => {
            if (!hasMutations || Date.now() - lastMutationTime > 500) {
              observer.disconnect()
              clearInterval(check)
              resolve()
            }
          }, 100)

          setTimeout(() => {
            observer.disconnect()
            clearInterval(check)
            resolve()
          }, maxWait)
        })
      })
    } catch {
      await ctx.pause(1000)
    }
  }
  const newNode = await captureState(ctx, currentUrl)

  const transition: StateTransition = {
    from: fromId,
    to: newNode.id,
    interaction,
    data: interaction.data,
  }

  return { newNode, transition }
}

function getStateDepth(matrix: FlowMatrix, stateId: string): number {
  if (stateId === matrix.startStateId) return 0

  const visitedLocal = new Set<string>()
  function bfs(id: string, depth: number): number {
    if (id === matrix.startStateId) return depth
    if (visitedLocal.has(id)) return Infinity
    visitedLocal.add(id)

    const incoming = matrix.transitions.filter((t) => t.to === id)
    if (incoming.length === 0) return Infinity

    let minDepth = Infinity
    for (const t of incoming) {
      const d = bfs(t.from, depth + 1)
      if (d < minDepth) minDepth = d
    }
    return minDepth
  }

  const d = bfs(stateId, 0)
  return d === Infinity ? 0 : d
}
