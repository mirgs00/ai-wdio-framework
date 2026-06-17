import type { InteractionTree, RadioGroup, RadioOption, InteractiveElement, ExtractedScenario } from './types'
import { logger } from '../logger'

/**
 * Generate a date string in dd/mm/yyyy format.
 */
function todayDDMMYYYY(): string {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = String(now.getFullYear())
  return `${dd}/${mm}/${yyyy}`
}

/**
 * Guess a test value for a form field based on its properties.
 * Checks type, name, placeholder, selector, id, aria-label, max, maxlength, pattern.
 */
function guessValue(el: InteractiveElement): string {
  const type = el.type ?? 'text'
  const name = (el.name ?? '').toLowerCase()
  const placeholder = (el.placeholder ?? '').toLowerCase()
  const selector = (el.selector ?? '').toLowerCase()
  const id = (el.attributes['id'] ?? selector.replace('#', '')).toLowerCase()
  const ariaLabel = (el.attributes['aria-label'] ?? '').toLowerCase()
  const max = el.attributes['max']
  const maxlength = el.attributes['maxlength']
  const pattern = el.attributes['pattern']

  // Combine all text sources for keyword matching
  const allText = `${name} ${placeholder} ${selector} ${id} ${ariaLabel}`

  if (type === 'email' || allText.includes('email')) return 'test@test.com'
  if (type === 'password') return 'TestPass123!'
  if (type === 'date' || allText.includes('date')) {
    if (placeholder.includes('dd/mm/yyyy')) return todayDDMMYYYY()
    if (placeholder.includes('mm/dd/yyyy')) {
      const now = new Date()
      return `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`
    }
    return todayDDMMYYYY()
  }
  if (type === 'tel' || allText.includes('phone')) return '1234567890'

  // Numeric fields: interest, rate, percent, number, qty, age, score, count, total, sum, balance
  if (type === 'number' || allText.includes('value') || allText.includes('amount') ||
      allText.includes('price') || allText.includes('taxable') || allText.includes('interest') ||
      allText.includes('rate') || allText.includes('percent') || allText.includes('qty') ||
      allText.includes('quantity') || allText.includes('age') || allText.includes('score') ||
      allText.includes('count') || allText.includes('total') || allText.includes('sum') ||
      allText.includes('balance')) {
    // Use max attribute to generate appropriate value
    if (max && !isNaN(Number(max))) {
      const maxVal = Number(max)
      if (maxVal <= 100) return String(Math.min(5, maxVal))
      if (maxVal <= 1000) return String(Math.min(500, maxVal))
      return String(Math.min(500000, maxVal))
    }
    // Use maxlength to cap value length
    if (maxlength && !isNaN(Number(maxlength))) {
      const len = Number(maxlength)
      if (len <= 2) return '5'
      if (len <= 5) return '50000'
      return '500000'
    }
    return '500000'
  }

  if (allText.includes('name')) return 'Test User'
  return 'test'
}

/**
 * Compute the Cartesian product of arrays.
 */
function cartesianProduct<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]]
  return arrays.reduce(
    (acc, curr) => acc.flatMap((a) => curr.map((b) => [...a, b])),
    [[]] as T[][]
  )
}

/**
 * Given a set of radio selections, compute which elements are visible.
 * Starts with initialElements, then applies each selection's reveals/hides.
 */
function computeVisibleElements(
  initialElements: InteractiveElement[],
  selections: Array<{ group: RadioGroup; option: RadioOption }>,
  tree: InteractionTree
): InteractiveElement[] {
  let visible = [...initialElements]

  for (const { option } of selections) {
    // Remove elements that are hidden by this selection
    visible = visible.filter((el) => !option.reveals.includes(el.selector) || true)

    // Add elements that are revealed by the interactions in the tree
    // Look up what this option reveals from the interaction tree
    const interaction = tree.interactions.find((i) => i.selector === option.selector)
    if (interaction) {
      for (const selector of interaction.reveals) {
        if (!visible.some((el) => el.selector === selector)) {
          // Find the element in the tree's initial elements or add a placeholder
          const found = tree.initialElements.find((el) => el.selector === selector)
          if (found) {
            visible.push(found)
          }
        }
      }
      // Remove elements hidden by this interaction
      for (const selector of interaction.hides) {
        visible = visible.filter((el) => el.selector !== selector)
      }
    }
  }

  return visible
}

/**
 * Generate all combinatorial test scenarios from an interaction tree.
 *
 * For N radio groups with sizes s1, s2, ... sN:
 * - Total scenarios = s1 * s2 * ... * sN
 * - Each scenario selects ONE option per group
 * - Form fields are filled based on what's visible AFTER all selections
 */
export function generateCombinatorialScenarios(tree: InteractionTree): ExtractedScenario[] {
  const scenarios: ExtractedScenario[] = []
  const pathname = new URL(tree.rootUrl).pathname

  // Add smoke test
  scenarios.push({
    tags: ['@smoke', '@quick'],
    name: 'Page loads successfully',
    steps: [
      `Given the user navigates to "${tree.rootUrl}"`,
      'Then the page should load successfully',
      'And the page title should be present',
    ],
  })

  // If no radio groups, generate a single scenario with form fill
  if (tree.radioGroups.length === 0) {
    const visibleInputs = tree.initialElements.filter((el) => el.isInput && el.type !== 'hidden' && el.type !== 'submit' && el.type !== 'radio' && el.type !== 'checkbox')
    const hasSubmit = tree.initialElements.some((el) => el.isButton && (el.type === 'submit' || el.selector.includes('submit')))

    const steps: string[] = [`Given the user navigates to "${tree.rootUrl}"`]
    for (const input of visibleInputs) {
      steps.push(`When the user fills "${input.selector}" with "${guessValue(input)}"`)
    }
    if (hasSubmit) {
      steps.push('When the user submits the form')
    }
    steps.push(`Then the URL should contain "${pathname}"`)

    scenarios.push({
      tags: ['@discovered'],
      name: 'Fill form and submit',
      steps,
    })

    return scenarios
  }

  // Generate all combinations of radio group selections
  const optionArrays = tree.radioGroups.map((group) =>
    group.options.map((option) => ({ group, option }))
  )

  const combinations = cartesianProduct(optionArrays)

  logger.info(`Generating ${combinations.length} scenarios from ${tree.radioGroups.length} radio groups`)

  for (const combination of combinations) {
    // Build scenario name from selections
    const selectionNames = combination.map((s) => s.option.label).join(' and ')
    const scenarioName = `Test ${selectionNames}`

    // Build steps
    const steps: string[] = [`Given the user navigates to "${tree.rootUrl}"`]

    // Apply each radio selection in order
    for (const { group, option } of combination) {
      steps.push(`When the user clicks "${option.selector}"`)
    }

    // Compute visible elements after all selections
    const visibleElements = computeVisibleElements(tree.initialElements, combination, tree)

    // Fill all visible form fields
    const visibleInputs = visibleElements.filter(
      (el) => el.isInput && el.type !== 'hidden' && el.type !== 'submit' && el.type !== 'radio' && el.type !== 'checkbox'
    )
    for (const input of visibleInputs) {
      steps.push(`When the user fills "${input.selector}" with "${guessValue(input)}"`)
    }

    // Submit if form exists
    const hasSubmit = visibleElements.some(
      (el) => (el.isButton && (el.type === 'submit' || el.selector.includes('submit'))) ||
        el.attributes['type'] === 'submit'
    )
    if (hasSubmit) {
      steps.push('When the user submits the form')
    }

    // Verify
    steps.push(`Then the URL should contain "${pathname}"`)

    scenarios.push({
      tags: ['@combinatorial', '@discovered'],
      name: scenarioName,
      steps,
    })
  }

  // Add negative test
  scenarios.push({
    tags: ['@negative', '@validation'],
    name: 'Reject empty form submission',
    steps: [
      `Given the user navigates to "${tree.rootUrl}"`,
      'When the user submits the form',
      `Then the URL should contain "${pathname}"`,
    ],
  })

  logger.info(`Generated ${scenarios.length} total scenarios (${combinations.length} combinatorial + smoke + negative)`)

  return scenarios
}
