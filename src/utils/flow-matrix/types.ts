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
}

export const DEFAULT_FLOW_CONFIG: FlowMatrixConfig = {
  maxDepth: 3,
  maxStates: 20,
  maxInteractionsPerState: 5,
  timeoutPerState: 15000,
  totalTimeoutMs: 120000,
  maxRadioDepth: 3,
}
