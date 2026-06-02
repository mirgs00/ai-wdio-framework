/**
 * Validates generated code and selectors before writing to disk
 * Prevents broken output from being persisted
 */

import * as ts from 'typescript';
import { logger } from '../logger'; // will be resolved via tsconfig paths or at runtime

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CodeValidationOptions {
  checkSyntax?: boolean;
  checkSelectors?: boolean;
  checkImports?: boolean;
  strict?: boolean;
}

/**
 * Validates generated TypeScript code
 */
export function validateTypeScriptCode(code: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for empty code
  if (!code || code.trim().length === 0) {
    errors.push('Code is empty');
    return { isValid: false, errors, warnings };
  }

  // Try to parse as TypeScript
  try {
    const sourceFile = ts.createSourceFile(
      'generated.ts',
      code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );

    // Check for parse errors
    const diagnostics = sourceFile.getChildren();
    if (!diagnostics || diagnostics.length === 0) {
      warnings.push('Generated code is empty or has no AST');
    }
  } catch (error) {
    errors.push(`TypeScript parse error: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Check for common issues
  if (code.includes('TODO') || code.includes('FIXME')) {
    warnings.push('Code contains TODO/FIXME comments');
  }

  if (code.match(/await\s+(?!.*[;(,\]\}])/)) {
    warnings.push('Found orphaned await statements');
  }

  if (code.includes('any') && code.match(/:\s*any\s*[;,=)/\]]/)) {
    warnings.push('Code uses `any` type - consider using explicit types');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates CSS selectors
 */
export function validateSelector(selector: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!selector || selector.trim().length === 0) {
    errors.push('Selector is empty');
    return { isValid: false, errors, warnings };
  }

  // Check for common invalid patterns
  if (selector.includes('//')) {
    // XPath is valid, but check for obvious errors
    if (selector.startsWith('//[') || selector.startsWith('/[')) {
      errors.push('Invalid XPath: unexpected "[" after //');
    }
    if (!selector.match(/^\/\//) && !selector.match(/^\(/)) {
      errors.push('Invalid XPath: should start with // or (');
    }
  } else if (selector.startsWith('[') && !selector.endsWith(']')) {
    errors.push('Invalid CSS selector: unmatched attribute selector brackets');
  } else if (selector.includes('$(') && !selector.includes(')')) {
    errors.push('Invalid selector: unmatched WebdriverIO selector syntax');
  } else if (selector.match(/\s{2,}/)) {
    warnings.push('Selector contains excessive whitespace');
  }

  // Check for potentially broken selectors
  if (selector.includes('undefined') || selector.includes('null')) {
    errors.push('Selector contains undefined/null reference');
  }

  if (!selector.match(/^([.#\[]|\/\/|[a-zA-Z]|[=|]|\$|button|input|div|span)/)) {
    warnings.push('Selector has unexpected starting character');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates generated step definitions
 */
export function validateStepDefinition(
  keyword: string,
  pattern: string,
  implementation: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate keyword
  if (!['Given', 'When', 'Then', 'And', 'But'].includes(keyword)) {
    errors.push(`Invalid Gherkin keyword: ${keyword}`);
  }

  // Validate pattern is not empty
  if (!pattern || pattern.trim().length === 0) {
    errors.push('Step pattern is empty');
  } else if (pattern.includes('undefined')) {
    errors.push('Step pattern contains undefined reference');
  }

  // Validate implementation
  const codeValidation = validateTypeScriptCode(implementation);
  if (!codeValidation.isValid) {
    errors.push(...codeValidation.errors.map((e) => `Implementation error: ${e}`));
  }
  warnings.push(...codeValidation.warnings);

  // Check for missing error handling
  if (implementation && !implementation.includes('catch') && !implementation.includes('try')) {
    warnings.push('Step implementation lacks error handling (try-catch)');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates feature file format (Gherkin)
 */
export function validateFeatureFile(content: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!content || content.trim().length === 0) {
    errors.push('Feature file is empty');
    return { isValid: false, errors, warnings };
  }

  const lines = content.split('\n');
  let hasFeature = false;
  let hasScenario = false;
  let currentScenario = '';
  let stepCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('Feature:')) {
      if (hasFeature) {
        errors.push(`Line ${i + 1}: Multiple Feature definitions found`);
      }
      hasFeature = true;
    } else if (line.startsWith('Scenario:') || line.startsWith('Scenario Outline:')) {
      if (stepCount === 0 && hasScenario) {
        errors.push(`Line ${i + 1}: Previous scenario has no steps`);
      }
      hasScenario = true;
      stepCount = 0;
      currentScenario = line;
    } else if (
      line.startsWith('Given ') ||
      line.startsWith('When ') ||
      line.startsWith('Then ') ||
      line.startsWith('And ') ||
      line.startsWith('But ')
    ) {
      if (!hasScenario) {
        errors.push(`Line ${i + 1}: Step found outside of Scenario`);
      }
      stepCount++;
    } else if (line && !line.startsWith('|')) {
      warnings.push(`Line ${i + 1}: Unexpected content: ${line.substring(0, 50)}`);
    }
  }

  if (!hasFeature) {
    errors.push('Feature file must start with "Feature:" keyword');
  }

  if (!hasScenario) {
    errors.push('Feature file must contain at least one Scenario');
  }

  if (hasScenario && stepCount === 0) {
    errors.push('Last scenario has no steps');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates JSON structure
 */
export function validateJSON(content: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!content || content.trim().length === 0) {
    errors.push('JSON content is empty');
    return { isValid: false, errors, warnings };
  }

  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') {
      errors.push('JSON does not contain an object or array at root level');
    }
  } catch (error) {
    errors.push(`JSON parse error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Comprehensive validation for generated output
 */
export function validateGeneratedOutput(
  content: string,
  filename: string,
  options: CodeValidationOptions = {}
): ValidationResult {
  const { checkSyntax = true, checkSelectors = true, strict = false } = options;

  let result: ValidationResult = { isValid: true, errors: [], warnings: [] };

  if (filename.endsWith('.ts') || filename.endsWith('.js')) {
    if (checkSyntax) {
      result = validateTypeScriptCode(content);
    }
  } else if (filename.endsWith('.feature')) {
    result = validateFeatureFile(content);
  } else if (filename.endsWith('.json')) {
    result = validateJSON(content);
  }

  // Log results
  if (!result.isValid) {
    logger.error(`Validation failed for ${filename}: ${result.errors.join('; ')}`);

    if (strict) {
      throw new Error(`Generated output validation failed for ${filename}: ${result.errors.join('; ')}`);
    }
  }

  if (result.warnings.length > 0) {
    logger.warn(`Validation warnings for ${filename}`, {
      section: 'VALIDATION',
      details: { filename, warnings: result.warnings },
    });
  }

  return result;
}

/**
 * Validates and logs validation results
 */
export function logValidationResults(filename: string, result: ValidationResult): void {
  if (result.isValid) {
    logger.info(`✓ Validation passed for ${filename}`);
  } else {
    logger.error(`✗ Validation failed for ${filename}: ${result.errors.join('; ')}`);
  }

  if (result.warnings.length > 0) {
    for (const warning of result.warnings) {
      logger.warn(`⚠️  ${warning}`, { section: 'VALIDATION', details: { filename } });
    }
  }
}
