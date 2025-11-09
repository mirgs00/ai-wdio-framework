export class AiFrameworkError extends Error {
  readonly code: string;
  readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string = 'FRAMEWORK_ERROR',
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AiFrameworkError';
    this.code = code;
    this.context = context;
    Object.setPrototypeOf(this, AiFrameworkError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }
}

export class ValidationError extends AiFrameworkError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class URLError extends AiFrameworkError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'URL_ERROR', context);
    this.name = 'URLError';
    Object.setPrototypeOf(this, URLError.prototype);
  }
}

export class DOMAnalysisError extends AiFrameworkError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'DOM_ANALYSIS_ERROR', context);
    this.name = 'DOMAnalysisError';
    Object.setPrototypeOf(this, DOMAnalysisError.prototype);
  }
}

export class AIGenerationError extends AiFrameworkError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'AI_GENERATION_ERROR', context);
    this.name = 'AIGenerationError';
    Object.setPrototypeOf(this, AIGenerationError.prototype);
  }
}

export class HealingError extends AiFrameworkError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'HEALING_ERROR', context);
    this.name = 'HealingError';
    Object.setPrototypeOf(this, HealingError.prototype);
  }
}
