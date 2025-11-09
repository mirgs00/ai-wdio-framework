export interface DOMElement {
  tag: string;
  id?: string;
  class?: string;
  name?: string;
  type?: string;
  text?: string;
  attributes: Record<string, string>;
  xpath: string;
  selector: string;
}

export interface GeneratedTest {
  featureFile: string;
  stepDefinitions: string;
  pageObjects: string;
}

export interface AIGenerationOptions {
  url: string;
  description: string;
  timeout?: number;
  model?: string;
}

export interface PageElement {
  name: string;
  selector: string;
  description: string;
  type?: string;
}

export interface ElementSelector {
  primary: string;
  fallback: string[];
  accessibilityRole?: string;
}

export interface StepDefinition {
  type: 'Given' | 'When' | 'Then' | 'And' | 'But';
  pattern: string;
  implementation: string;
  originalText: string;
  parameters: string[];
}

export interface ScenarioDefinition {
  title: string;
  description?: string;
  steps: StepDefinition[];
  tags?: string[];
  examples?: Record<string, string>[];
}

export interface FeatureDefinition {
  title: string;
  description?: string;
  scenarios: ScenarioDefinition[];
  backgroundSteps?: StepDefinition[];
}

export interface TestResult {
  success: boolean;
  duration: number;
  message?: string;
  screenshot?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface AppConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  headless: boolean;
  browser: 'chrome' | 'firefox' | 'safari' | 'edge';
}

export interface FrameworkConfig {
  cucumberOpts: {
    require: string[];
    format: string[];
    parallel: number;
  };
  mochaOpts: {
    timeout: number;
    retries: number;
  };
}

export interface AIClientConfig {
  baseUrl: string;
  model: string;
  timeout: number;
  maxRetries: number;
  retryDelayMs: number;
}

export interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
}

export type AsyncFunction<TArgs extends unknown[] = unknown[], TReturn = unknown> = (
  ...args: TArgs
) => Promise<TReturn>;

export type SelectorStrategy = 'id' | 'name' | 'xpath' | 'css' | 'testId' | 'accessibility';
