import { InteractiveElement, PageType } from './types'

export function computeFingerprint(
  url: string,
  pageType: PageType,
  elements: InteractiveElement[]
): string {
  const urlObj = new URL(url)
  const pathKey = urlObj.pathname + urlObj.search + urlObj.hash

  const sorted = [...elements]
    .sort((a, b) => a.selector.localeCompare(b.selector))
    .map((el) => `${el.tag}:${el.type ?? ''}:${el.name ?? ''}:${el.selector}`)
    .join('|')

  // Include checked/selected state of radios and checkboxes
  const checkedState = elements
    .filter((el) => el.isInput && (el.type === 'radio' || el.type === 'checkbox'))
    .map((el) => `${el.selector}:${el.attributes['checked'] || 'false'}`)
    .sort()
    .join('|')

  const raw = `${pageType}::${pathKey}::${sorted}::checked:${checkedState}`
  return simpleHash(raw)
}

export function classifyPageType(
  elements: InteractiveElement[],
  url?: string,
  title?: string
): PageType {
  const lowerUrl = (url ?? '').toLowerCase()
  const lowerTitle = (title ?? '').toLowerCase()

  const elTexts = elements
    .map((el) => (el.text ?? '').toLowerCase())
    .filter(Boolean)
  const allText = [...elTexts, lowerTitle, lowerUrl].join(' ')

  // Helpers
  const hasInputWithType = (type: string) =>
    elements.some((el) => el.isInput && el.type === type)
  const hasNameLike = (pattern: string) =>
    elements.some(
      (el) =>
        el.name?.toLowerCase().includes(pattern) ||
        el.placeholder?.toLowerCase().includes(pattern)
    )
  const hasTextLike = (pattern: string) =>
    elTexts.some((t) => t.includes(pattern))
  const hasButtonText = (pattern: string) =>
    elements.some(
      (el) =>
        (el.isButton || el.isLink) &&
        (el.text ?? '').toLowerCase().includes(pattern)
    )
  const hasAnyElement = () => elements.length > 0

  // 1. Error page — 404/500 codes or "not found" in text or URL
  if (
    lowerUrl.includes('/404') ||
    lowerUrl.includes('/500') ||
    lowerUrl.includes('error') ||
    allText.includes('404') ||
    allText.includes('500') ||
    allText.includes('not found') ||
    allText.includes('page not found')
  ) {
    return 'error'
  }

  // 2. Login — password + email/username + submit
  const hasPassword = hasInputWithType('password')
  const hasEmailOrUsername =
    hasInputWithType('email') ||
    hasNameLike('email') ||
    hasNameLike('username')
  const hasSubmit =
    elements.some(
      (el) =>
        el.isButton ||
        (el.isInput && el.type === 'submit') ||
        (el.isInput && el.type === 'button')
    )

  if (hasPassword && hasEmailOrUsername && hasSubmit) return 'login'

  // 3. Register — password + email + confirm/signup-specific elements
  const hasConfirmPassword =
    hasNameLike('confirm') ||
    hasNameLike('confirm password') ||
    elements.some((el) => (el.name ?? '').toLowerCase().includes('confirm'))
  const isSignup =
    hasButtonText('sign up') ||
    hasButtonText('create account') ||
    hasButtonText('register') ||
    lowerUrl.includes('signup') ||
    lowerUrl.includes('register') ||
    lowerTitle.includes('sign up') ||
    lowerTitle.includes('register')

  if (hasPassword && hasEmailOrUsername && (hasConfirmPassword || isSignup)) {
    return 'register'
  }

  // 4. Checkout — checkout context + payment/shipping fields
  const isCheckout =
    lowerUrl.includes('checkout') ||
    lowerUrl.includes('cart') ||
    lowerTitle.includes('checkout') ||
    lowerTitle.includes('cart') ||
    hasTextLike('checkout') ||
    hasTextLike('place order') ||
    hasTextLike('purchase') ||
    hasTextLike('payment') ||
    hasButtonText('place order') ||
    hasButtonText('purchase') ||
    hasNameLike('card') ||
    hasNameLike('credit') ||
    hasNameLike('address')

  if (
    isCheckout &&
    elements.filter((el) => el.isInput).length >= 2
  ) {
    return 'checkout'
  }

  // 5. Product — add-to-cart pattern or product URL
  const isProduct =
    lowerUrl.includes('/product/') ||
    lowerUrl.includes('/p/') ||
    lowerUrl.includes('/item/') ||
    lowerTitle.includes('buy') ||
    lowerTitle.includes('product') ||
    hasButtonText('add to cart') ||
    hasButtonText('add to bag') ||
    hasButtonText('buy now')

  if (isProduct && hasAnyElement()) return 'product'

  // 6. Search — search input
  const hasSearchInput =
    hasInputWithType('search') ||
    hasNameLike('search')

  if (hasSearchInput) return 'search'

  // 7. Dashboard — dashboard context
  const isDashboard =
    lowerUrl.includes('dashboard') ||
    lowerUrl.includes('/account') ||
    lowerUrl.includes('/profile') ||
    lowerTitle.includes('dashboard') ||
    lowerTitle.includes('my account') ||
    lowerTitle.includes('profile') ||
    hasTextLike('logout') ||
    hasTextLike('sign out') ||
    hasButtonText('logout') ||
    hasButtonText('sign out')

  if (isDashboard) return 'dashboard'

  // 8. Listing — multiple repeated items, pagination
  const hasPagination =
    hasTextLike('next') ||
    hasTextLike('previous') ||
    elements.some((el) => el.text?.toLowerCase().includes('page'))
  const isListing =
    lowerUrl.includes('/search') ||
    lowerUrl.includes('/category') ||
    lowerUrl.includes('/products') ||
    lowerUrl.includes('/browse') ||
    lowerUrl.includes('/list') ||
    lowerTitle.includes('search results') ||
    lowerTitle.includes('listing') ||
    lowerTitle.includes('products') ||
    lowerTitle.includes('browse')

  if ((isListing || hasPagination) && hasAnyElement()) return 'listing'

  // 9. Home — root or landing page
  if (
    lowerUrl === '' ||
    lowerUrl === '/' ||
    lowerUrl.endsWith('/') ||
    lowerTitle.includes('home') ||
    lowerTitle.includes('welcome')
  ) {
    return 'home'
  }

  // 10. Form — any page with form elements (existing fallback)
  const hasFormElements = elements.some(
    (el) => el.isInput || el.isSelect || el.isForm
  )
  if (hasFormElements) return 'form'

  // 11. Generic — catch-all
  return 'generic'
}

function simpleHash(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(16)
}
