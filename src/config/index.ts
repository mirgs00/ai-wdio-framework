export interface OllamaConfig {
  baseUrl: string;
  model: string;
  timeout: number;
  maxRetries: number;
  retryDelayMs: number;
}

export interface WebdriverConfig {
  headless: boolean;
  browser: 'chrome' | 'firefox' | 'safari' | 'edge';
  timeout: number;
}

export interface GenerationConfig {
  outputDir: string;
  overwrite: boolean;
  includeComments: boolean;
}

export interface FrameworkConfig {
  ollama: OllamaConfig;
  webdriver: WebdriverConfig;
  generation: GenerationConfig;
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: FrameworkConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): FrameworkConfig {
    return {
      ollama: {
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'llama3',
        timeout: this.parseNumber(process.env.OLLAMA_TIMEOUT, 30000),
        maxRetries: this.parseNumber(process.env.OLLAMA_MAX_RETRIES, 3),
        retryDelayMs: this.parseNumber(process.env.OLLAMA_RETRY_DELAY_MS, 1000),
      },
      webdriver: {
        headless: this.parseBoolean(process.env.HEADLESS, true),
        browser: (process.env.BROWSER || 'chrome') as 'chrome' | 'firefox' | 'safari' | 'edge',
        timeout: this.parseNumber(process.env.WDIO_TIMEOUT, 60000),
      },
      generation: {
        outputDir: process.env.OUTPUT_DIR || './src/features',
        overwrite: this.parseBoolean(process.env.OVERWRITE, false),
        includeComments: this.parseBoolean(process.env.INCLUDE_COMMENTS, true),
      },
    };
  }

  private parseNumber(value: string | undefined, defaultValue: number): number {
    if (!value) return defaultValue;
    const num = parseInt(value, 10);
    return isNaN(num) ? defaultValue : num;
  }

  private parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
    if (!value) return defaultValue;
    return value.toLowerCase() === 'true';
  }

  public getConfig(): FrameworkConfig {
    return this.config;
  }

  public getOllamaConfig(): OllamaConfig {
    return this.config.ollama;
  }

  public getWebdriverConfig(): WebdriverConfig {
    return this.config.webdriver;
  }

  public getGenerationConfig(): GenerationConfig {
    return this.config.generation;
  }

  public updateConfig(partial: Partial<FrameworkConfig>): void {
    this.config = {
      ...this.config,
      ...partial,
    };
  }

  public validateConfig(): string[] {
    const errors: string[] = [];

    if (!this.config.ollama.baseUrl) {
      errors.push('OLLAMA_BASE_URL is required');
    }

    if (!this.config.ollama.model) {
      errors.push('OLLAMA_MODEL is required');
    }

    if (this.config.ollama.timeout <= 0) {
      errors.push('OLLAMA_TIMEOUT must be greater than 0');
    }

    if (this.config.webdriver.timeout <= 0) {
      errors.push('WDIO_TIMEOUT must be greater than 0');
    }

    const validBrowsers = ['chrome', 'firefox', 'safari', 'edge'];
    if (!validBrowsers.includes(this.config.webdriver.browser)) {
      errors.push(`Browser must be one of: ${validBrowsers.join(', ')}`);
    }

    return errors;
  }
}

export function getConfig(): FrameworkConfig {
  return ConfigManager.getInstance().getConfig();
}

export function getConfigManager(): ConfigManager {
  return ConfigManager.getInstance();
}
