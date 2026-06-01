import { InteractiveElement } from './types'
import { OllamaClient } from '../ai/ollamaClient'

export interface BrowserContext {
  url: (url: string) => Promise<void>
  execute: <T>(fn: (...args: any[]) => T | Promise<T>, ...args: any[]) => Promise<T>
  $: (selector: string) => Promise<{
    click: () => Promise<void>
    setValue: (value: string) => Promise<void>
    waitForDisplayed: (opts?: { timeout?: number }) => Promise<void>
    getText: () => Promise<string>
  }>
  keys: (keys: string | string[]) => Promise<void>
  getUrl: () => Promise<string>
  getTitle: () => Promise<string>
  waitUntil: (condition: () => Promise<boolean>, opts?: { timeout?: number; timeoutMsg?: string }) => Promise<void>
  pause: (ms: number) => Promise<void>
  closeSession: () => Promise<void>
  $$: (selector: string) => Promise<Array<{ getTagName: () => Promise<string>; getAttribute: (name: string) => Promise<string | null>; getText: () => Promise<string> }>>
}

export async function dismissOverlays(ctx: BrowserContext): Promise<void> {
  await ctx.execute(() => {
    const selectorPatterns = [
      '[class*="cookie"]', '[id*="cookie"]',
      '[class*="consent"]', '[id*="consent"]',
      '[class*="modal"]', '[id*="modal"]',
      '[class*="popup"]', '[id*="popup"]',
      '[class*="overlay"]', '[id*="overlay"]',
      '[class*="dialog"]', '[id*="dialog"]',
    ]

    const dismissTexts = [
      'accept', 'accept all', 'accept cookies',
      'reject', 'reject all', 'reject cookies',
      'close', 'dismiss', 'got it', 'i agree',
      'consent', 'allow', 'decline', 'continue',
    ]

    function isVisible(el: HTMLElement): boolean {
      if (el.offsetParent === null) return false
      if (el.style.display === 'none') return false
      if (el.style.visibility === 'hidden') return false
      return true
    }

    function tryDismiss(container: Element): void {
      const buttons = Array.from(
        container.querySelectorAll(
          'button, a[href], [role="button"], input[type="button"], input[type="submit"]'
        )
      ) as HTMLElement[]
      for (const btn of buttons) {
        if (!isVisible(btn)) continue
        const text = (btn.textContent || '').trim().toLowerCase()
        const ariaLabel = (btn.getAttribute('aria-label') || '').trim().toLowerCase()
        if (dismissTexts.some((t) => text === t || ariaLabel === t || text.includes(t) || ariaLabel.includes(t))) {
          btn.click()
          return
        }
      }
    }

    for (const sel of selectorPatterns) {
      const elements = Array.from(document.querySelectorAll(sel)) as HTMLElement[]
      for (const el of elements) {
        if (isVisible(el)) tryDismiss(el)
      }
    }
  })
}

export async function clickElement(ctx: BrowserContext, selector: string): Promise<void> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await dismissOverlays(ctx)
      const el = await ctx.$(selector)
      await el.waitForDisplayed({ timeout: 6000 })
      await el.click()
      return
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt === 0) {
        await ctx.pause(1000)
      }
    }
  }

  throw lastError || new Error(`Failed to click element: ${selector}`)
}

export async function safeNavigate(ctx: BrowserContext, url: string): Promise<void> {
  await ctx.url(url)
  await ctx.waitUntil(
    async () => (await ctx.execute(() => document.readyState)) === 'complete',
    { timeout: 15000, timeoutMsg: 'Page did not load' }
  )
}

const FORM_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const FORM_AI_TIMEOUT = 15_000 // 15 seconds
const FORM_CACHE_MAX = 100

interface CacheEntry {
  data: Record<string, string>
  timestamp: number
}

const formDataCache = new Map<string, CacheEntry>()

function trimCache(): void {
  if (formDataCache.size <= FORM_CACHE_MAX) return
  const entries = [...formDataCache.entries()].sort(
    (a, b) => a[1].timestamp - b[1].timestamp
  )
  const toRemove = formDataCache.size - FORM_CACHE_MAX
  for (let i = 0; i < toRemove; i++) {
    formDataCache.delete(entries[i][0])
  }
}

export async function generateFormData(
  elements: InteractiveElement[],
  ollamaClient: OllamaClient
): Promise<Record<string, string>> {
  const inputElements = elements.filter(
    (el) =>
      el.isInput &&
      el.type !== 'submit' &&
      el.type !== 'button' &&
      el.type !== 'hidden' &&
      el.type !== 'checkbox' &&
      el.type !== 'radio'
  )
  if (inputElements.length === 0) return {}

  const fieldDescriptions = inputElements
    .map(
      (el) =>
        `- selector: "${el.selector}", type: "${el.type ?? 'text'}", name: "${el.name ?? ''}", placeholder: "${el.placeholder ?? ''}"`
    )
    .join('\n')

  // Check cache (keyed on normalized field info)
  const cacheKey = inputElements
    .map((el) => `${el.type ?? 'text'}:${el.name ?? ''}:${el.placeholder ?? ''}`)
    .join('|')
  const cached = formDataCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < FORM_CACHE_TTL) {
    return cached.data
  }

  const prompt = `Generate realistic test data for each form field. Return ONLY a JSON object with selectors as keys and values as strings.

Form fields:
${fieldDescriptions}

Rules:
- email fields → valid email like "test_<timestamp>@test.com"
- password fields → "TestPass123!"
- name fields → "Test User"
- number fields → "12345"
- phone fields → "1234567890"
- text fields → contextually relevant test data
- Use timestamp-based uniqueness for email fields to avoid conflicts

JSON only, no markdown, no explanations:`

  try {
    const response = await Promise.race([
      ollamaClient.generateText(prompt),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Form data AI timeout')), FORM_AI_TIMEOUT)
      ),
    ])
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0])
      // Replace cached email timestamps with fresh ones to avoid reuse conflicts
      for (const key of Object.keys(data)) {
        if (typeof data[key] === 'string') {
          data[key] = (data[key] as string).replace(/(test_)\d+(?=@)/, `$1${Date.now()}`)
        }
      }
      formDataCache.set(cacheKey, { data, timestamp: Date.now() })
      trimCache()
      return data
    }
  } catch {
    // fallback below
  }

  const fallback = generateFallbackData(inputElements)
  formDataCache.set(cacheKey, { data: fallback, timestamp: Date.now() })
  trimCache()
  return fallback
}

function generateFallbackData(
  elements: InteractiveElement[]
): Record<string, string> {
  const data: Record<string, string> = {}
  const ts = Date.now()
  for (const el of elements) {
    const type = el.type ?? 'text'
    const name = (el.name ?? '').toLowerCase()
    const selector = (el.selector ?? '').toLowerCase()
    const placeholder = (el.placeholder ?? '').toLowerCase()
    if (type === 'email' || name.includes('email') || placeholder.includes('email')) {
      data[el.selector] = `test_${ts}@test.com`
    } else if (type === 'password') {
      data[el.selector] = 'TestPass123!'
    } else if (type === 'tel' || name.includes('phone') || placeholder.includes('phone')) {
      data[el.selector] = '1234567890'
    } else if (type === 'number' || name.includes('value') || name.includes('amount') || name.includes('price') || name.includes('taxable') || selector.includes('value') || selector.includes('amount')) {
      data[el.selector] = '500000'
    } else if (el.isSelect || type === 'select-one') {
      data[el.selector] = '' // let fillForm pick the first option
    } else if (name.includes('name') || placeholder.includes('name')) {
      data[el.selector] = 'Test User'
    } else {
      data[el.selector] = 'test'
    }
  }
  return data
}

export async function fillForm(
  ctx: BrowserContext,
  elements: InteractiveElement[],
  formData: Record<string, string>
): Promise<void> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await dismissOverlays(ctx)
      await ctx.execute(() => {
        document.querySelectorAll('iframe').forEach((ifr) => {
          (ifr as HTMLElement).style.display = 'none'
        })
      })

      for (const [selector, value] of Object.entries(formData)) {
        const tagName = await ctx.execute(
          (sel: string) => {
            const el = document.querySelector(sel)
            return el ? el.tagName.toLowerCase() : null
          },
          selector
        )

        if (tagName === 'select') {
          // Handle <select> elements: set value and dispatch change event
          const set = await ctx.execute(
            (sel: string, val: string) => {
              const el = document.querySelector(sel) as HTMLSelectElement
              if (el) {
                // Check if the value matches an option
                const matchingOption = Array.from(el.options).find(
                  (opt) => opt.value === val
                )
                if (matchingOption) {
                  el.value = val
                  el.dispatchEvent(new Event('change', { bubbles: true }))
                  el.dispatchEvent(new Event('input', { bubbles: true }))
                  return true
                }
                // If no match, try selecting the first option
                if (el.options.length > 0) {
                  el.selectedIndex = 0
                  el.dispatchEvent(new Event('change', { bubbles: true }))
                  el.dispatchEvent(new Event('input', { bubbles: true }))
                  return true
                }
                return false
              }
              return false
            },
            selector,
            value
          )
          if (!set) {
            try {
              const el = await ctx.$(selector)
              await el.setValue(value)
            } catch {
              // skip
            }
          }
        } else {
          // Text/textarea/input handling
          const set = await ctx.execute(
            (sel: string, val: string) => {
              const el = document.querySelector(sel) as HTMLInputElement
              if (el) {
                el.value = val
                el.dispatchEvent(new Event('input', { bubbles: true }))
                return true
              }
              return false
            },
            selector,
            value
          )
          if (!set) {
            try {
              const el = await ctx.$(selector)
              await el.setValue(value)
            } catch {
              // skip fields that can't be found
            }
          }
        }
      }
      return
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt === 0) {
        await ctx.pause(1000)
      }
    }
  }

  throw lastError || new Error('Failed to fill form')
}

export function sanitizeDescription(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/["']/g, '')
    .trim()
    .slice(0, 60)
}

export function friendlySelector(sel: string): string {
  if (/[[\]()]/.test(sel)) {
    const match = sel.match(/(?:#|\.)([\w-]+)/)
    if (match) return match[1]
    return 'element'
  }
  return sel
}
