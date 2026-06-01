import { FlowMatrix, ExtractedScenario, StateNode, StateTransition, InteractiveElement, FlowMatrixConfig, DEFAULT_FLOW_CONFIG } from './types'

function sanitize(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/["']/g, '').trim().slice(0, 80)
}

export function extractScenarios(
  matrix: FlowMatrix,
  config?: Partial<FlowMatrixConfig>
): ExtractedScenario[] {
  const maxRadioDepth = config?.maxRadioDepth ?? DEFAULT_FLOW_CONFIG.maxRadioDepth ?? 3
  const scenarios: ExtractedScenario[] = []

  for (const [, state] of matrix.states) {
    if (state.id === matrix.startStateId) continue

    const path = findShortestPath(matrix, matrix.startStateId, state.id)
    if (path.length === 0) continue

    const scenario = buildScenarioFromPath(matrix, path, state)
    if (scenario) {
      scenarios.push(scenario)
    }
  }

  // Generate additional variant scenarios for radio/checkbox/select selections
  const startState = matrix.states.get(matrix.startStateId)
  if (startState) {
    const radioVariants = generateRadioVariants(
      matrix, startState, matrix.rootUrl, 0, maxRadioDepth
    )
    for (const variant of radioVariants) {
      if (!scenarios.some((s) => s.name === variant.name)) {
        scenarios.push(variant)
      }
    }
    const selectVariants = generateSelectVariants(matrix, startState)
    for (const variant of selectVariants) {
      if (!scenarios.some((s) => s.name === variant.name)) {
        scenarios.push(variant)
      }
    }
  }

  // Deduplicate all scenarios by step content
  const seen = new Set<string>()
  return scenarios.filter((s) => {
    const fp = s.steps.join('|')
    if (seen.has(fp)) return false
    seen.add(fp)
    return true
  })
}

/**
 * Recursive chained radio variant generator.
 *
 * Walks the transition graph: for each radio option in the current state,
 * follows the transition to its destination state, detects new elements that
 * appeared, and recurses deeper when new radio groups are found.  The result is
 * a full end‑to‑end scenario matrix that covers cascading radio selections.
 */
function generateRadioVariants(
  matrix: FlowMatrix,
  state: StateNode,
  rootUrl: string,
  depth: number,
  maxDepth: number,
  rootSubmitData?: Record<string, string>
): ExtractedScenario[] {
  const variants: ExtractedScenario[] = []
  const radios = state.elements.filter((el) => el.isInput && el.type === 'radio')
  const checkboxes = state.elements.filter((el) => el.isInput && el.type === 'checkbox')
  if (radios.length === 0 && checkboxes.length === 0) return variants

  // Group radios by name (each group gets one selection)
  const radioGroups = new Map<string, InteractiveElement[]>()
  for (const r of radios) {
    const name = r.name || 'unknown'
    if (!radioGroups.has(name)) radioGroups.set(name, [])
    radioGroups.get(name)!.push(r)
  }

  // Submit transitions from the current state
  const submitTransitions = matrix.transitions.filter(
    (t) => t.from === state.id && t.interaction.type === 'submit'
  )
  // Determine whether a submit exists at this level or above
  const hasSubmit = depth === 0
    ? (submitTransitions.length > 0)
    : !!(rootSubmitData)

  // Pass root-level form data down so all levels can include it
  const effectiveFormData = depth === 0 && submitTransitions.length > 0
    ? submitTransitions[0].data
    : rootSubmitData

  // --- Radio buttons: chained recursive walker ---
  for (const [, group] of radioGroups) {
    for (const option of group) {
      const label = option.selector.replace(/^#/, '')

      // Try to follow the transition that this radio click creates
      const transition = findRadioTransition(matrix, state.id, option.selector)

      if (transition) {
        const destState = matrix.states.get(transition.to)
        if (destState) {
          const existingSelectors = new Set(state.elements.map((e) => e.selector))
          const newElements = destState.elements.filter(
            (el) => !existingSelectors.has(el.selector)
          )
          const newRadios = newElements.filter(
            (el) => el.isInput && el.type === 'radio'
          )
          const newInputs = newElements.filter((el) =>
            isFillableInput(el)
          )

          // --- Build form fill steps for THIS level ---
          // Used in both terminating and merged recursive scenarios
          const levelFillSteps: string[] = []
          for (const inp of newInputs) {
            levelFillSteps.push(
              `When the user fills "${sanitize(inp.selector)}" with "${guessInputValue(inp)}"`
            )
          }

          // --- Terminating scenario at this level ---
          const terminatingSteps: string[] = []
          terminatingSteps.push(`Given the user navigates to "${rootUrl}"`)
          terminatingSteps.push(`When the user clicks "${sanitize(label)}"`)
          terminatingSteps.push(...levelFillSteps)
          if (effectiveFormData) {
            for (const [sel, val] of Object.entries(effectiveFormData)) {
              terminatingSteps.push(
                `When the user fills "${sanitize(sel)}" with "${sanitize(val)}"`
              )
            }
          }
          if (hasSubmit) {
            terminatingSteps.push('When the user submits the form')
          }
          addVerifySteps(terminatingSteps, destState)
          variants.push({
            tags: ['@discovered', `@page-type:${destState.pageType}`, '@radio-variant'],
            name: `${destState.pageType} with "${label}"${hasSubmit ? ' and submit' : ''}`,
            steps: terminatingSteps,
          })

          // --- Recursive cascade: deeper radio groups appeared ---
          if (depth < maxDepth && newRadios.length > 0) {
            const subScenarios = generateRadioVariants(
              matrix, destState, rootUrl, depth + 1, maxDepth, effectiveFormData
            )
            for (const sub of subScenarios) {
              const merged = [...sub.steps]
              merged.splice(1, 0, `When the user clicks "${sanitize(label)}"`)
              merged.splice(2, 0, ...levelFillSteps)
              variants.push({
                tags: [
                  '@discovered',
                  `@page-type:${destState.pageType}`,
                  '@radio-matrix',
                ],
                name: `${destState.pageType} chain "${label}" → ${sub.name}`,
                steps: merged,
              })
            }
          }

          continue
        }
      }

      // --- Fallback: no transition found or no destination state ---
      // Generate a single-level variant
      const steps: string[] = []
      steps.push(`Given the user navigates to "${rootUrl}"`)
      steps.push(`When the user clicks "${sanitize(label)}"`)
      if (submitTransitions.length > 0) {
        const data = submitTransitions[0].data
        if (data) {
          for (const [sel, val] of Object.entries(data)) {
            steps.push(
              `When the user fills "${sanitize(sel)}" with "${sanitize(val)}"`
            )
          }
        }
        steps.push('When the user submits the form')
      }
      addVerifySteps(steps, state)
      variants.push({
        tags: ['@discovered', `@page-type:${state.pageType}`, '@radio-variant'],
        name: `${state.pageType} selecting "${label}"`,
        steps,
      })
    }
  }

  // --- Checkboxes: single-level only ---
  for (const cb of checkboxes) {
    const label = cb.selector.replace(/^#/, '')
    const steps: string[] = []
    steps.push(`Given the user navigates to "${rootUrl}"`)
    steps.push(`When the user clicks "${sanitize(label)}"`)
    if (submitTransitions.length > 0) {
      const data = submitTransitions[0].data
      if (data) {
        for (const [sel, val] of Object.entries(data)) {
          steps.push(
            `When the user fills "${sanitize(sel)}" with "${sanitize(val)}"`
          )
        }
      }
      steps.push('When the user submits the form')
    }
    addVerifySteps(steps, state)
    variants.push({
      tags: ['@discovered', `@page-type:${state.pageType}`, '@radio-variant'],
      name: `${state.pageType} with "${label}"`,
      steps,
    })
  }

  return variants
}

/** Find a click transition from a given state whose selector matches. */
function findRadioTransition(
  matrix: FlowMatrix,
  fromId: string,
  selector: string
): StateTransition | null {
  for (const t of matrix.transitions) {
    if (t.from === fromId && t.interaction.type === 'click' && t.interaction.selector === selector) {
      return t
    }
  }
  return null
}

/** Returns true for text-like inputs that can be filled with setValue. */
function isFillableInput(el: InteractiveElement): boolean {
  const fillable = ['text', 'search', 'email', 'url', 'tel', 'number', 'password']
  return el.isInput && fillable.includes(el.type ?? '')
}

/** Guess a sensible test value for a form input based on its type/name. */
function guessInputValue(el: InteractiveElement): string {
  const type = el.type ?? 'text'
  const name = (el.name ?? '').toLowerCase()
  const placeholder = (el.placeholder ?? '').toLowerCase()
  if (type === 'email' || name.includes('email') || placeholder.includes('email')) return 'test@test.com'
  if (type === 'password') return 'TestPass123!'
  if (type === 'tel' || name.includes('phone') || placeholder.includes('phone')) return '1234567890'
  if (type === 'number' || name.includes('value') || name.includes('amount') || name.includes('price')) return '500000'
  if (name.includes('name') || placeholder.includes('name')) return 'Test User'
  return 'test'
}

/** Append title / URL / text‑content verification steps. */
function addVerifySteps(steps: string[], state: StateNode): void {
  if (state.title) {
    steps.push(`Then the page title should contain "${state.title}"`)
  }
  if (state.url) {
    try {
      steps.push(`Then the URL should contain "${new URL(state.url).pathname}"`)
    } catch {
      /* skip invalid URL */
    }
  }
  const textEl = state.elements.find((el) => el.text && el.text.length > 3)
  if (textEl?.text) {
    steps.push(`Then the user should see "${textEl.text.slice(0, 50)}"`)
  }
}

/**
 * Generates variant scenarios for <select> option values within the same state.
 * Tests a subset of non-default options for each select element.
 */
function generateSelectVariants(
  matrix: FlowMatrix,
  state: StateNode
): ExtractedScenario[] {
  const variants: ExtractedScenario[] = []
  const selects = state.elements.filter((el) => el.isSelect)

  // Find submit/form interactions for this state
  const submitTransitions = matrix.transitions.filter(
    (t) => t.from === state.id && t.interaction.type === 'submit'
  )

  for (const sel of selects) {
    const optionsStr = sel.attributes['_selectOptions']
    if (!optionsStr) continue
    let options: string[]
    try {
      options = JSON.parse(optionsStr)
    } catch {
      continue
    }
    if (options.length <= 1) continue

    // Pick a subset of non-default options to test (skip first = default)
    // Test up to 2 additional values: last, and optionally a middle one
    const testValues: string[] = []
    if (options.length > 1) testValues.push(options[options.length - 1])
    if (options.length > 2) testValues.push(options[1]) // second option
    if (options.length > 3) testValues.push(options[Math.floor(options.length / 2)])

    for (const val of testValues) {
      const optionLabel = val === '' ? '(empty string)' : (val || '(empty)')

      if (submitTransitions.length > 0) {
        // Create variant with select value change + form fill + submit
        for (const st of submitTransitions) {
          const steps: string[] = []
          steps.push(`Given the user navigates to "${matrix.rootUrl}"`)

          // Add form fill steps, overriding the select's value
          const data = st.data ? { ...st.data } : {}
          data[sel.selector] = val

          for (const [s, v] of Object.entries(data)) {
            steps.push(
              `When the user fills "${sanitize(s)}" with "${sanitize(v)}"`
            )
          }

          steps.push(`When the user submits the form`)

          // Add verification steps
          const title = state.title
          const url = state.url
          if (title) {
            steps.push(`Then the page title should contain "${title}"`)
          }
          if (url) {
            try {
              steps.push(
                `Then the URL should contain "${new URL(url).pathname}"`
              )
            } catch {
              /* skip if URL is invalid */
            }
          }

          variants.push({
            tags: ['@discovered', `@page-type:${state.pageType}`, '@select-variant'],
            name: `Navigate to ${state.pageType} page with ${sel.name || sel.selector} = "${optionLabel}"`,
            steps,
          })
        }
      }
    }
  }

  return variants
}

function findShortestPath(
  matrix: FlowMatrix,
  fromId: string,
  toId: string
): StateTransition[] {
  const visited = new Set<string>()
  const queue: Array<{ id: string; path: StateTransition[] }> = [
    { id: fromId, path: [] },
  ]
  visited.add(fromId)

  while (queue.length > 0) {
    const current = queue.shift()!

    for (const transition of matrix.transitions) {
      if (transition.from !== current.id) continue
      if (visited.has(transition.to)) continue
      if (transition.to === toId) {
        return [...current.path, transition]
      }
      visited.add(transition.to)
      queue.push({
        id: transition.to,
        path: [...current.path, transition],
      })
    }
  }

  return []
}

function buildScenarioFromPath(
  matrix: FlowMatrix,
  path: StateTransition[],
  targetState: StateNode
): ExtractedScenario | null {
  if (path.length === 0) return null

  const startState = matrix.states.get(matrix.startStateId)
  if (!startState) return null

  const steps: string[] = []
  const tags: string[] = ['@discovered', `@page-type:${targetState.pageType}`]

  steps.push(`Given the user navigates to "${matrix.rootUrl}"`)

  for (let i = 0; i < path.length; i++) {
    const t = path[i]
    const step = transitionToStep(t, i === path.length - 1, targetState)
    steps.push(...step)
  }

  const pageTypeLabel = targetState.pageType.charAt(0).toUpperCase() + targetState.pageType.slice(1)
  const scenarioName = `Navigate to ${pageTypeLabel} page${targetState.title ? `: ${targetState.title.replace(/["']/g, '')}` : ''}`

  return { tags, name: scenarioName, steps }
}

function transitionToStep(
  transition: StateTransition,
  isLast: boolean,
  targetState: StateNode
): string[] {
  const steps: string[] = []
  const interaction = transition.interaction

  if (interaction.type === 'click') {
    steps.push(
      `When the user clicks "${sanitize(interaction.description.replace(/^(Click|Navigate|Go to) /, ''))}"`
    )
  } else if (interaction.type === 'submit') {
    const data = transition.data
    if (data && Object.keys(data).length > 0) {
      for (const [selector, value] of Object.entries(data)) {
        steps.push(
          `When the user fills "${sanitize(selector)}" with "${sanitize(value)}"`
        )
      }
    }
    steps.push(`When the user submits the form`)
  } else if (interaction.type === 'setValue') {
    const data = transition.data
    if (data && Object.keys(data).length > 0) {
      for (const [selector, value] of Object.entries(data)) {
        steps.push(
          `When the user fills "${sanitize(selector)}" with "${sanitize(value)}"`
        )
      }
    }
  }

  if (isLast) {
    const title = targetState.title
    const url = targetState.url
    if (title) {
      steps.push(`Then the page title should contain "${title}"`)
    }
    if (url) {
      steps.push(`Then the URL should contain "${new URL(url).pathname}"`)
    }

    const hasText = targetState.elements.some(
      (el) => el.text && el.text.length > 3
    )
    if (hasText) {
      const sampleText = targetState.elements
        .find((el) => el.text && el.text.length > 3)
        ?.text?.slice(0, 50)
      if (sampleText) {
        steps.push(`Then the user should see "${sampleText}"`)
      }
    }
  }

  return steps
}
