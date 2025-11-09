import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogContext {
  section?: string;
  step?: string;
  duration?: number;
  details?: Record<string, unknown>;
}

class Logger {
  private logLevel: LogLevel = LogLevel.INFO;
  private logFilePath: string;
  private fileEnabled: boolean = false;
  private performanceMetrics: Map<string, number[]> = new Map();

  constructor(logFile?: string) {
    this.logFilePath = logFile || path.join(process.cwd(), 'generate_output.log');
    try {
      this.initializeLogFile();
      this.fileEnabled = true;
    } catch (error) {
      console.warn('Failed to initialize log file:', error);
      this.fileEnabled = false;
    }
  }

  private initializeLogFile(): void {
    const logDir = path.dirname(this.logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.writeFileSync(
      this.logFilePath,
      `\n===== LOG SESSION STARTED: ${new Date().toISOString()} =====\n`
    );
  }

  private writeToFile(message: string): void {
    if (!this.fileEnabled) return;
    try {
      fs.appendFileSync(this.logFilePath, message + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentIndex = levels.indexOf(this.logLevel);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= currentIndex;
  }

  private formatMessage(message: string, context?: LogContext): string {
    let formatted = message;
    if (context?.section) {
      formatted = `[${context.section}] ${formatted}`;
    }
    if (context?.duration !== undefined) {
      formatted += ` (${context.duration}ms)`;
    }
    return formatted;
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const formatted = this.formatMessage(message, context);
      console.debug(`[DEBUG] ${formatted}`);
      this.writeToFile(`[DEBUG] ${formatted}`);
      if (context?.details) {
        this.writeToFile(JSON.stringify(context.details, null, 2));
      }
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const formatted = this.formatMessage(message, context);
      console.log(`[INFO] ${formatted}`);
      this.writeToFile(`[INFO] ${formatted}`);
      if (context?.details) {
        this.writeToFile(JSON.stringify(context.details, null, 2));
      }
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const formatted = this.formatMessage(message, context);
      console.warn(`[WARN] ${formatted}`);
      this.writeToFile(`[WARN] ${formatted}`);
      if (context?.details) {
        this.writeToFile(JSON.stringify(context.details, null, 2));
      }
    }
  }

  error(message: string, error?: Error | unknown): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      let errorMessage = `[ERROR] ${message}`;
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
        if (error.stack) {
          errorMessage += `\nStack: ${error.stack}`;
        }
      } else if (error) {
        errorMessage += `: ${JSON.stringify(error)}`;
      }
      console.error(errorMessage);
      this.writeToFile(errorMessage);
    }
  }

  logOllamaApiCall(prompt: string, model: string, temperature: number): void {
    const context: LogContext = {
      section: 'OLLAMA_API',
      details: {
        timestamp: new Date().toISOString(),
        model,
        temperature,
        promptLength: prompt.length,
        promptPreview: prompt.substring(0, 100) + '...',
      },
    };
    this.info(`🔄 Calling Ollama API (${model})...`, context);
  }

  logOllamaResponse(response: string, model: string, duration: number, tokensUsed?: number): void {
    const context: LogContext = {
      section: 'OLLAMA_RESPONSE',
      duration,
      details: {
        timestamp: new Date().toISOString(),
        model,
        responseLength: response.length,
        tokensUsed,
        responsePreview: response.substring(0, 200) + '...',
      },
    };
    this.info(`✅ Ollama response received`, context);
  }

  logElementDiscovery(
    pageName: string,
    elements: unknown[],
    metadata?: Record<string, unknown>
  ): void {
    const context: LogContext = {
      section: 'DOM_ANALYSIS',
      details: {
        timestamp: new Date().toISOString(),
        pageName,
        elementCount: Array.isArray(elements) ? elements.length : 0,
        elements,
        ...metadata,
      },
    };
    this.info(`📊 Elements discovered on ${pageName}`, context);
  }

  logPageObjectGeneration(
    pageName: string,
    pageUrl: string,
    elementCount: number,
    filename: string
  ): void {
    const context: LogContext = {
      section: 'PAGE_OBJECT_GENERATION',
      details: {
        timestamp: new Date().toISOString(),
        pageName,
        pageUrl,
        elementCount,
        filename,
      },
    };
    this.info(`✅ Generated page object: ${filename}`, context);
  }

  logStepDefinition(stepPattern: string, description: string, implementation: string): void {
    const context: LogContext = {
      section: 'STEP_DEFINITION',
      details: {
        timestamp: new Date().toISOString(),
        stepPattern,
        description,
        implementationPreview: implementation.substring(0, 300) + '...',
        implementationLength: implementation.length,
      },
    };
    this.info(`⚙️ Processing step: "${stepPattern}"`, context);
  }

  logAiIntervention(issue: string, resolution: string, affectedFile: string): void {
    const context: LogContext = {
      section: 'AI_INTERVENTION',
      details: {
        timestamp: new Date().toISOString(),
        issue,
        resolution,
        affectedFile,
      },
    };
    this.info(`🤖 AI intervention applied`, context);
  }

  logTestExecution(
    featureName: string,
    status: 'PASS' | 'FAIL',
    duration: number,
    summary?: Record<string, unknown>
  ): void {
    const context: LogContext = {
      section: 'TEST_EXECUTION',
      duration,
      details: {
        timestamp: new Date().toISOString(),
        featureName,
        status,
        ...summary,
      },
    };
    this.info(`🧪 Test execution completed: ${status}`, context);
  }

  logHealing(testName: string, issue: string, regeneratedElements?: unknown[]): void {
    const context: LogContext = {
      section: 'SELF_HEALING',
      details: {
        timestamp: new Date().toISOString(),
        testName,
        issue,
        regeneratedElementCount: Array.isArray(regeneratedElements)
          ? regeneratedElements.length
          : 0,
        regeneratedElements,
      },
    };
    this.info(`🔧 Self-healing triggered for: ${testName}`, context);
  }

  recordMetric(category: string, duration: number): void {
    if (!this.performanceMetrics.has(category)) {
      this.performanceMetrics.set(category, []);
    }
    this.performanceMetrics.get(category)!.push(duration);
  }

  getSummary(): Record<string, unknown> {
    const summary: Record<string, unknown> = {};
    for (const [category, durations] of this.performanceMetrics) {
      summary[category] = {
        calls: durations.length,
        totalMs: durations.reduce((a, b) => a + b, 0),
        avgMs: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
        minMs: Math.min(...durations),
        maxMs: Math.max(...durations),
      };
    }
    return summary;
  }

  logSummary(title: string): void {
    const summary = this.getSummary();
    const summaryText = `\n\n===== ${title} =====\n${JSON.stringify(summary, null, 2)}\n`;
    console.log(summaryText);
    this.writeToFile(summaryText);
  }
}

export const logger = new Logger();
