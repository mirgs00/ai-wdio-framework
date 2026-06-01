export interface LLMOptions {
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  top_p?: number;
  repeat_penalty?: number;
}

export interface LLMProvider {
  generateText(prompt: string, options?: LLMOptions): Promise<string>;
  checkHealth(): Promise<boolean>;
  getModel(): string;
}

export interface LLMProviderConfig {
  baseUrl?: string;
  model?: string;
  defaultOptions?: LLMOptions;
  timeout?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}
