export interface InteractiveElement {
  tag: string
  selector: string
  type?: string
  name?: string
  placeholder?: string
  text?: string
  attributes: Record<string, string>
  isButton: boolean
  isLink: boolean
  isInput: boolean
  isForm: boolean
  isSelect: boolean
}

export type PageType =
  | 'home'
  | 'login'
  | 'register'
  | 'search'
  | 'form'
  | 'checkout'
  | 'product'
  | 'listing'
  | 'dashboard'
  | 'error'
  | 'generic'

export interface StateNode {
  id: string
  url: string
  title: string
  pageType: PageType
  fingerprint: string
  elements: InteractiveElement[]
}

export interface Interaction {
  type: 'click' | 'setValue' | 'submit' | 'select'
  selector: string
  value?: string
  description: string
  data?: Record<string, string>
}

export interface StateTransition {
  from: string
  to: string
  interaction: Interaction
  data?: Record<string, string>
}

export interface FlowMatrix {
  rootUrl: string
  states: Map<string, StateNode>
  transitions: StateTransition[]
  startStateId: string
}

export interface ExtractedScenario {
  tags: string[]
  name: string
  steps: string[]
}

export interface FlowMatrixConfig {
  maxDepth: number
  maxStates: number
  maxInteractionsPerState: number
  timeoutPerState: number
  totalTimeoutMs: number
  maxRadioDepth?: number
  smokeOnly?: boolean
}

export const DEFAULT_FLOW_CONFIG: FlowMatrixConfig = {
  maxDepth: 5,
  maxStates: 50,
  maxInteractionsPerState: 15,
  timeoutPerState: 15000,
  totalTimeoutMs: 300000,
  maxRadioDepth: 5,
}

// --- Combinatorial Interaction Discovery Types ---

export interface ElementInteraction {
  selector: string
  type: 'radio' | 'checkbox' | 'select' | 'button' | 'link' | 'setValue'
  name?: string
  value?: string
  label: string
  reveals: string[]
  hides: string[]
  navigatesTo?: string
  subInteractions?: ElementInteraction[]
}

export interface RadioGroup {
  name: string
  options: RadioOption[]
}

export interface RadioOption {
  selector: string
  value: string
  label: string
  reveals: string[]
}

export interface InteractionTree {
  rootUrl: string
  initialElements: InteractiveElement[]
  interactions: ElementInteraction[]
  radioGroups: RadioGroup[]
}
