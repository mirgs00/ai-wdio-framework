import { OllamaClient, type OllamaClientConfig } from './ollamaClient';
import { MockLLMProvider } from './MockLLMProvider';
import type { LLMProvider } from './types';
import { OLLAMA_CONFIG, TIMEOUTS, RETRY_CONFIG } from '../constants';

export interface LLMProviderOptions {
  model?: string;
  timeout?: number;
  maxRetries?: number;
  disabled?: boolean;
}

export function createDefaultLLMProvider(options: LLMProviderOptions = {}): LLMProvider {
  if (options.disabled || process.env.OLLAMA_DISABLE === 'true') {
    return new MockLLMProvider();
  }

  const config: OllamaClientConfig = {
    baseUrl: process.env.OLLAMA_BASE_URL || OLLAMA_CONFIG.DEFAULT_BASE_URL,
    model: options.model || process.env.OLLAMA_MODEL || OLLAMA_CONFIG.DEFAULT_MODEL,
    timeout: options.timeout || (process.env.OLLAMA_TIMEOUT ? parseInt(process.env.OLLAMA_TIMEOUT) : TIMEOUTS.API_TIMEOUT),
    maxRetries: options.maxRetries ?? (process.env.OLLAMA_MAX_RETRIES ? parseInt(process.env.OLLAMA_MAX_RETRIES) : RETRY_CONFIG.MAX_RETRIES),
    retryDelayMs: process.env.OLLAMA_RETRY_DELAY_MS
      ? parseInt(process.env.OLLAMA_RETRY_DELAY_MS)
      : RETRY_CONFIG.INITIAL_DELAY_MS,
  };

  return new OllamaClient(config);
}
