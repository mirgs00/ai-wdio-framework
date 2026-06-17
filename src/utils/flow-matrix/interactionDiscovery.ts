import type { BrowserContext } from './interactionEngine'
import type { InteractiveElement, ElementInteraction, RadioGroup, RadioOption, InteractionTree } from './types'
import { dismissOverlays } from './interactionEngine'
import { logger } from '../logger'

/**
 * Scans all visible interactive elements on the page.
 * Reuses the same browser-side scanning logic as stateExplorer.
 */
async function scanElements(ctx: BrowserContext): Promise<InteractiveElement[]> {
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
      if (el.id) return `#${CSS.escape(el.id)}`
      const dataTest = el.getAttribute('data-test') || el.getAttribute('data-testid') || el.getAttribute('data-qa')
      if (dataTest) return `[data-test="${dataTest}"]`
      const ariaLabel = el.getAttribute('aria-label')
      if (ariaLabel) return `[aria-label="${ariaLabel}"]`
      if (el.getAttribute('name')) return `[name="${el.getAttribute('name')}"]`
      if (el.getAttribute('title')) return `[title="${el.getAttribute('title')}"]`
      if (el.tagName === 'A' && (el as HTMLAnchorElement).href) {
        const href = (el as HTMLAnchorElement).href
        return `a[href="${href}"]`
      }
      const parent = el.parentElement
      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === el.tagName)
        const idx = siblings.indexOf(el) + 1
        const parentSel = getSelector(parent)
        return `${parentSel} > ${el.tagName.toLowerCase()}:nth-child(${idx})`
      }
      return el.tagName.toLowerCase()
    }

    const tags = ['a', 'button', 'input', 'select', 'textarea']
    const roleSelectors = ['[role="button"]', '[role="radio"]', '[role="checkbox"]', '[role="combobox"]']
    const seen = new Set<string>()

    for (const tag of tags) {
      const els = document.querySelectorAll(tag) as unknown as HTMLElement[]
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
          if (el.type === 'radio' || el.type === 'checkbox') {
            attrs['checked'] = String(el.checked)
          }
        } else if (el instanceof HTMLSelectElement) {
          name = el.name
          attrs['_selectOptions'] = JSON.stringify(Array.from(el.options).map((o) => o.value || o.text).filter(Boolean))
        } else if (el instanceof HTMLTextAreaElement) {
          name = el.name
          placeholder = el.placeholder
        } else if (el instanceof HTMLElement) {
          text = (el.textContent || '').trim().slice(0, 100)
        }

        results.push({ tag: el.tagName.toLowerCase(), selector, type, name, placeholder, text, attributes: attrs })
      }
    }

    for (const sel of roleSelectors) {
      const els = document.querySelectorAll(sel) as unknown as HTMLElement[]
      for (const el of els) {
        if (el instanceof HTMLElement && el.offsetParent === null) continue
        if (el instanceof HTMLElement && el.style.display === 'none') continue
        const selector = getSelector(el)
        if (seen.has(selector)) continue
        seen.add(selector)
        const attrs: Record<string, string> = {}
        for (let i = 0; i < el.attributes.length; i++) {
          attrs[el.attributes[i].name] = el.attributes[i].value
        }
        attrs['role'] = el.getAttribute('role') || ''
        results.push({
          tag: el.tagName.toLowerCase(),
          selector,
          type: el.getAttribute('role') || undefined,
          name: el.getAttribute('aria-label') || undefined,
          text: (el.textContent || '').trim().slice(0, 100),
          attributes: attrs,
        })
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
    isButton: r.tag === 'button' || r.type === 'submit' || r.type === 'button' || r.attributes['role'] === 'button',
    isLink: r.tag === 'a',
    isInput: r.tag === 'input' || r.tag === 'textarea' || r.type === 'textbox',
    isForm: r.tag === 'form',
    isSelect: r.tag === 'select' || r.type === 'combobox',
  }))
}

/**
 * Check if an element is interactable (radio, checkbox, select, button, link).
 */
function isInteractable(el: InteractiveElement): boolean {
  if (el.isButton) return true
  if (el.isLink) return true
  if (el.isSelect) return true
  if (el.type === 'radio' || el.type === 'checkbox') return true
  if (el.attributes['role'] === 'radio' || el.attributes['role'] === 'checkbox') return true
  return false
}

/**
 * Check if an element is a radio or checkbox.
 */
function isRadioOrCheckbox(el: InteractiveElement): boolean {
  return el.type === 'radio' || el.type === 'checkbox' ||
    el.attributes['role'] === 'radio' || el.attributes['role'] === 'checkbox'
}

/**
 * Wait for DOM to settle after an interaction.
 */
async function waitForDOMSettle(ctx: BrowserContext, maxWaitMs: number = 5000): Promise<void> {
  try {
    await ctx.execute((maxWait: number) => {
      return new Promise<void>((resolve) => {
        let lastMutationTime = Date.now()
        let hasMutations = false
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
    }, maxWaitMs)
  } catch {
    await ctx.pause(500)
  }
}

/**
 * Click an element by selector.
 */
async function clickElement(ctx: BrowserContext, selector: string): Promise<boolean> {
  try {
    const el = await ctx.$(selector)
    if (el) {
      await dismissOverlays(ctx)
      await el.click()
      return true
    }
  } catch {
    // Try by ID
    try {
      const id = selector.replace(/^#/, '')
      const el = await ctx.$(`#${id}`)
      if (el) {
        await dismissOverlays(ctx)
        await el.click()
        return true
      }
    } catch {
      // skip
    }
  }
  return false
}

/**
 * Compute the difference between two element lists.
 */
function diffElements(before: InteractiveElement[], after: InteractiveElement[]): { reveals: string[]; hides: string[] } {
  const beforeSelectors = new Set(before.map((e) => e.selector))
  const afterSelectors = new Set(after.map((e) => e.selector))
  const reveals = after.filter((e) => !beforeSelectors.has(e.selector)).map((e) => e.selector)
  const hides = before.filter((e) => !afterSelectors.has(e.selector)).map((e) => e.selector)
  return { reveals, hides }
}

/**
 * Discover all interactions on a page by systematically interacting with every element.
 * For each interactable element, click it, record what new elements appear, then restore state.
 */
export async function discoverInteractions(
  ctx: BrowserContext,
  rootUrl: string,
  options: { maxDepth?: number; maxInteractions?: number; timeoutMs?: number } = {}
): Promise<InteractionTree> {
  const maxDepth = options.maxDepth ?? 3
  const maxInteractions = options.maxInteractions ?? 50
  const timeoutMs = options.timeoutMs ?? 120000
  const startTime = Date.now()

  logger.info(`Starting interaction discovery for: ${rootUrl}`)

  // Navigate to the page
  await ctx.url(rootUrl)
  await ctx.waitUntil(
    async () => (await ctx.execute(() => document.readyState)) === 'complete',
    { timeout: 10000 }
  )
  await waitForDOMSettle(ctx)

  const initialElements = await scanElements(ctx)
  logger.info(`Found ${initialElements.length} initial elements`)

  const interactions: ElementInteraction[] = []
  const radioGroups = new Map<string, RadioGroup>()

  async function discover(depth: number, contextElements: InteractiveElement[]): Promise<ElementInteraction[]> {
    if (depth >= maxDepth) return []
    if (Date.now() - startTime > timeoutMs) return []
    if (interactions.length >= maxInteractions) return []

    const results: ElementInteraction[] = []
    const interactable = contextElements.filter(isInteractable)

    for (const el of interactable) {
      if (Date.now() - startTime > timeoutMs) break
      if (interactions.length >= maxInteractions) break

      logger.info(`  Interacting with: ${el.selector} (${el.type || el.tag})`)

      // Capture state before interaction
      const beforeElements = await scanElements(ctx)
      const currentUrl = await ctx.getUrl()

      // Perform the interaction
      let navigated = false
      if (el.type === 'radio' || el.type === 'checkbox' || el.attributes['role'] === 'radio' || el.attributes['role'] === 'checkbox') {
        await clickElement(ctx, el.selector)
      } else if (el.isButton || el.attributes['role'] === 'button') {
        await clickElement(ctx, el.selector)
      } else if (el.isSelect) {
        // Select the second option (first non-default)
        try {
          await ctx.execute((sel: string) => {
            const select = document.querySelector(sel) as HTMLSelectElement
            if (select && select.options.length > 1) {
              select.value = select.options[1].value
              select.dispatchEvent(new Event('change', { bubbles: true }))
            }
          }, el.selector)
        } catch {
          await clickElement(ctx, el.selector)
        }
      } else if (el.isLink) {
        const href = el.attributes['href']
        if (href && (href.startsWith('/') || href.startsWith(window?.location?.origin || ''))) {
          navigated = true
          await clickElement(ctx, el.selector)
        } else {
          continue // skip off-site links
        }
      } else {
        continue // skip non-interactable
      }

      // Wait for DOM to settle
      await waitForDOMSettle(ctx)

      // Capture state after interaction
      const afterElements = await scanElements(ctx)
      const newUrl = await ctx.getUrl()
      const { reveals, hides } = diffElements(beforeElements, afterElements)

      const interaction: ElementInteraction = {
        selector: el.selector,
        type: (el.type as ElementInteraction['type']) || 'button',
        name: el.name,
        value: el.attributes['value'],
        label: el.attributes['value'] || el.name || el.text || el.selector,
        reveals,
        hides,
        navigatesTo: newUrl !== currentUrl ? newUrl : undefined,
      }

      results.push(interaction)
      interactions.push(interaction)

      // Track radio groups
      if (isRadioOrCheckbox(el) && el.name) {
        if (!radioGroups.has(el.name)) {
          radioGroups.set(el.name, { name: el.name, options: [] })
        }
        const group = radioGroups.get(el.name)!
        if (!group.options.some((o) => o.selector === el.selector)) {
          group.options.push({
            selector: el.selector,
            value: el.attributes['value'] || '',
            label: el.attributes['value'] || el.name || el.selector,
            reveals,
          })
        }
      }

      // Recurse if new interactable elements appeared
      if (reveals.length > 0 && depth < maxDepth - 1) {
        const newInteractable = afterElements.filter(isInteractable)
        const subResults = await discover(depth + 1, newInteractable)
        if (subResults.length > 0) {
          interaction.subInteractions = subResults
        }
      }

      // Restore state
      if (navigated || newUrl !== currentUrl) {
        await ctx.url(rootUrl)
        await ctx.waitUntil(
          async () => (await ctx.execute(() => document.readyState)) === 'complete',
          { timeout: 10000 }
        )
        await waitForDOMSettle(ctx)
      } else {
        // For SPA: unclick the radio/checkbox or navigate back
        if (isRadioOrCheckbox(el)) {
          // Click it again to unselect (toggle)
          await clickElement(ctx, el.selector)
          await waitForDOMSettle(ctx)
        }
      }
    }

    return results
  }

  const rootInteractions = await discover(0, initialElements)

  const tree: InteractionTree = {
    rootUrl,
    initialElements,
    interactions: rootInteractions,
    radioGroups: Array.from(radioGroups.values()),
  }

  logger.info(`Discovery complete: ${interactions.length} interactions, ${radioGroups.size} radio groups`)
  for (const [name, group] of radioGroups) {
    logger.info(`  Radio group "${name}": ${group.options.length} options`)
  }

  return tree
}
