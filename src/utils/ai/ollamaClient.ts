// src/utils/ai/ollamaClient.ts
import fetch, { RequestInit } from 'node-fetch';
import { AbortError } from 'node-fetch';
import { logger } from '../logger';

export interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
}

export interface OllamaOptions {
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  top_p?: number;
  repeat_penalty?: number;
  retries?: number;
  retryDelayMs?: number;
}

export interface OllamaClientConfig {
  baseUrl?: string;
  model?: string;
  defaultOptions?: OllamaOptions;
  timeout?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

export class OllamaClient {
  private ollamaClientBaseUrl: string;
  private model: string;
  private defaultOptions: OllamaOptions;
  private timeout: number;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(config: OllamaClientConfig = {}) {
    this.ollamaClientBaseUrl = config.baseUrl || 'http://localhost:11434';
    this.model = config.model || 'llama3';
    this.defaultOptions = config.defaultOptions || {
      temperature: 0.3,
      max_tokens: 500,
      top_p: 0.9,
      repeat_penalty: 1.1
    };
    this.timeout = config.timeout || 120000;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 1000;
  }

  private sanitizeDOM(dom: string, maxLength: number = 5000): string {
    if (dom.length <= maxLength) {
      return dom;
    }
    console.warn(`DOM content truncated from ${dom.length} to ${maxLength} characters to prevent API overload`);
    return dom.slice(0, maxLength) + '\n<!-- ...truncated... -->';
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isRetryableError(status: number, error: unknown): boolean {
    if (status >= 500 && status < 600) return true;
    if (status === 408 || status === 429) return true;
    
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
    if (errorMessage.includes('timeout') || errorMessage.includes('econnrefused')) {
      return true;
    }
    
    return false;
  }

  async generateText(
    prompt: string,
    options?: OllamaOptions
  ): Promise<string> {
    const maxRetries = options?.retries ?? this.maxRetries;
    const retryDelayMs = options?.retryDelayMs ?? this.retryDelayMs;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.attemptGenerateText(prompt, options);
      } catch (error) {
        lastError = error as Error;
        const isRetryable = error instanceof Error && (
          error.message.includes('500') ||
          error.message.includes('timeout') ||
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('503') ||
          error.message.includes('502')
        );

        if (!isRetryable || attempt === maxRetries) {
          throw error;
        }

        const delayMs = retryDelayMs * Math.pow(2, attempt);
        console.warn(`⚠️ Ollama API error (attempt ${attempt + 1}/${maxRetries + 1}): ${error instanceof Error ? error.message : error}`);
        console.log(`⏳ Retrying in ${delayMs}ms...`);
        await this.sleep(delayMs);
      }
    }

    throw lastError || new Error('Failed to generate text after retries');
  }

  private async attemptGenerateText(
    prompt: string,
    options?: OllamaOptions
  ): Promise<string> {
    const url = `${this.ollamaClientBaseUrl}/api/generate`;
    const mergedOptions = { ...this.defaultOptions, ...options };

    const bodyPayload = {
      model: this.model,
      prompt,
      stream: false,
      options: {
        temperature: mergedOptions.temperature,
        num_predict: mergedOptions.max_tokens,
        top_p: mergedOptions.top_p,
        repeat_penalty: mergedOptions.repeat_penalty
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    const startTime = Date.now();

    try {
      logger.logOllamaApiCall(prompt, this.model, mergedOptions.temperature!);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      } as RequestInit);

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      logger.recordMetric('ollama_api_call', duration);

      if (!response.ok) {
        const errorBody = await response.text();
        const errorMsg = `Ollama API error: ${response.status} ${response.statusText}`;
        logger.error(errorMsg, new Error(errorBody));
        throw new Error(errorMsg);
      }

      const data = (await response.json()) as OllamaResponse;
      logger.logOllamaResponse(data.response, this.model, duration);
      return data.response;
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (error instanceof AbortError) {
        throw new Error(`Ollama API timeout after ${this.timeout}ms`);
      }

      if (error instanceof Error && 'code' in error && error.code === 'ECONNREFUSED') {
        throw new Error(`Ollama connection refused. Please ensure:
1. Ollama is running (try 'ollama serve')
2. Service is accessible at ${this.ollamaClientBaseUrl}
3. No firewall is blocking the connection`);
      }

      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async prompt(arg: string | { prompt: string; systemPrompt?: string }): Promise<string> {
    let promptText: string;
    let systemPrompt: string | undefined;

    if (typeof arg === 'string') {
      promptText = arg;
    } else {
      promptText = arg.prompt;
      systemPrompt = arg.systemPrompt;
    }

    const fullPrompt = systemPrompt ? `${systemPrompt}\n${promptText}` : promptText;

    return await this.generateText(fullPrompt, {
      temperature: 0.4,
      max_tokens: 800,
    });
  }

  async generateStepImplementation(
    step: string,
    context: {
      stepType: 'Given' | 'When' | 'Then';
      pageElements?: string[];
    }
  ): Promise<string> {
    const prompt = `Generate WebdriverIO step implementation for: "${step}"
    
Requirements:
1. Use ONLY standard WebdriverIO v8+ methods
2. Never use custom methods or page objects
3. Include proper waits and assertions
4. Use these WebdriverIO methods:
   - browser.url()
   - browser.waitUntil()
   - browser.execute()
   - $().click()/setValue()/submit()
   - expect().toBeDisplayed()/toHaveText() etc.
5. Return ONLY the code (no explanations)

Example for "I navigate to login page":
\`\`\`
await browser.url('/login');
await browser.waitUntil(
    async () => (await browser.execute(() => document.readyState)) === 'complete',
    { timeout: 10000 }
);
\`\`\`

Now implement: "${step}"`;

    return this.generateText(prompt, { temperature: 0.2 });
  }

  private generateFallbackStep(step: string, stepType: string): string {
    const lowerStep = step.toLowerCase();

    if (lowerStep.includes('submit') && lowerStep.includes('invalid')) {
      return `
try {
  await $('#username').setValue('invalid-email');
  await $('#password').setValue('short');
  await $('form').submit();
  
  await expect($('.error-message')).toBeDisplayed();
} catch (error) {
  await browser.takeScreenshot('form-submission-error');
  throw error;
}`;
    }

    return `
try {
  console.warn('Using fallback for step: "${step}"');
  await browser.pause(1000);
} catch (error) {
  throw new Error(\`Step failed: \${error.message}\`);
}`;
  }

  async generateSteps(prompt: string, dom?: string): Promise<string> {
    const sanitizedDOM = dom ? this.sanitizeDOM(dom, 5000) : '';
    const enhancedPrompt = sanitizedDOM 
      ? `DOM Context:\n${sanitizedDOM}\n\n${prompt}`
      : prompt;
    
    return await this.generateText(enhancedPrompt, {
      temperature: 0.4,
      max_tokens: 800,
      retries: 3,
      retryDelayMs: 2000,
    });
  }

  async checkHealth(): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${this.ollamaClientBaseUrl}/api/tags`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      console.error('Health check failed:', error instanceof Error ? error.message : error);
      return false;
    }
  }
}

/**
 * Generates test step implementations using the Ollama AI API.
 * Optionally includes DOM context for more accurate code generation.
 * 
 * @param prompt - The prompt describing what steps to generate
 * @param dom - Optional DOM content to provide context for generation
 * @returns Promise resolving to generated step implementation code
 * @throws Error if Ollama API call fails
 */
export async function generateSteps(prompt: string, dom?: string): Promise<string> {
  const client = new OllamaClient();
  return await client.generateSteps(prompt, dom);
}

/**
 * Creates an OllamaClient instance with optional configuration.
 * Uses environment variables as defaults for Ollama connection settings.
 * 
 * @param config - Optional configuration object to override environment variables
 * @returns Configured OllamaClient instance
 */
export function createOllamaClient(config?: OllamaClientConfig): OllamaClient {
  return new OllamaClient({
    baseUrl: process.env.OLLAMA_BASE_URL,
    model: process.env.OLLAMA_MODEL,
    timeout: process.env.OLLAMA_TIMEOUT 
      ? parseInt(process.env.OLLAMA_TIMEOUT)
      : 120000,
    maxRetries: process.env.OLLAMA_MAX_RETRIES
      ? parseInt(process.env.OLLAMA_MAX_RETRIES)
      : 3,
    retryDelayMs: process.env.OLLAMA_RETRY_DELAY_MS
      ? parseInt(process.env.OLLAMA_RETRY_DELAY_MS)
      : 1000,
    ...config
  });
}
