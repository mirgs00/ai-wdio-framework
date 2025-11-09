export interface ValidationResult {
  passed: boolean;
  score: number;
  issues: string[];
  warnings: string[];
  suggestions: string[];
}

export class ScenarioQualityValidator {
  validateScenarioContent(featureContent: string): ValidationResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    const lines = featureContent.split('\n');
    const hasFeature = lines.some((l) => l.trim().startsWith('Feature:'));
    if (!hasFeature) {
      issues.push('Missing "Feature:" keyword');
      score -= 20;
    }

    const scenarioCount = (featureContent.match(/Scenario:/g) || []).length;
    if (scenarioCount === 0) {
      issues.push('No scenarios found');
      score -= 30;
    } else if (scenarioCount < 2) {
      warnings.push('Only one scenario found. Consider adding more test cases.');
      score -= 10;
    } else if (scenarioCount > 10) {
      warnings.push(
        `${scenarioCount} scenarios found. Consider breaking into multiple feature files.`
      );
    }

    const givenCount = (featureContent.match(/\bGiven\b/g) || []).length;
    const whenCount = (featureContent.match(/\bWhen\b/g) || []).length;
    const thenCount = (featureContent.match(/\bThen\b/g) || []).length;

    if (givenCount === 0) {
      warnings.push('No "Given" steps found. Preconditions improve clarity.');
      score -= 5;
    }

    if (whenCount === 0) {
      issues.push('No "When" steps found. Scenarios must include user actions.');
      score -= 15;
    }

    if (thenCount === 0) {
      issues.push('No "Then" steps found. Scenarios must include assertions.');
      score -= 15;
    }

    const totalSteps = givenCount + whenCount + thenCount;
    if (totalSteps > 0) {
      const avgStepsPerScenario = totalSteps / scenarioCount;
      if (avgStepsPerScenario > 10) {
        warnings.push(
          `Average ${avgStepsPerScenario.toFixed(1)} steps per scenario. Consider breaking into smaller scenarios.`
        );
        score -= 5;
      } else if (avgStepsPerScenario < 3) {
        warnings.push(
          `Average ${avgStepsPerScenario.toFixed(1)} steps per scenario. Scenarios may be too simple.`
        );
        score -= 3;
      }
    }

    const invalidGherkin = lines.filter((l) => {
      const trimmed = l.trim();
      return (
        trimmed.length > 0 &&
        !trimmed.startsWith('Feature:') &&
        !trimmed.startsWith('Scenario:') &&
        !trimmed.startsWith('Background:') &&
        !trimmed.startsWith('Given') &&
        !trimmed.startsWith('When') &&
        !trimmed.startsWith('Then') &&
        !trimmed.startsWith('And') &&
        !trimmed.startsWith('But') &&
        !trimmed.startsWith('@') &&
        !trimmed.startsWith('#')
      );
    });

    if (invalidGherkin.length > 5) {
      warnings.push(`${invalidGherkin.length} lines contain non-Gherkin content`);
      score -= 10;
    }

    const hasTags = featureContent.includes('@');
    if (!hasTags) {
      suggestions.push('Add tags (@tag-name) to scenarios for better organization');
      score -= 5;
    }

    const hasBackground = featureContent.includes('Background:');
    if (!hasBackground && scenarioCount > 3) {
      suggestions.push('Consider using Background: for common setup steps');
    }

    const ambiguousKeywords = ['click button', 'check field', 'verify something'];
    for (const keyword of ambiguousKeywords) {
      if (featureContent.toLowerCase().includes(keyword)) {
        suggestions.push(`Found vague keyword "${keyword}". Use more specific step descriptions.`);
      }
    }

    const hasDataVariables = featureContent.includes('<') && featureContent.includes('>');
    if (!hasDataVariables && scenarioCount > 5) {
      suggestions.push('Consider using scenario outlines with Examples: for data-driven tests');
    }

    return {
      passed: issues.length === 0,
      score: Math.max(0, score),
      issues,
      warnings,
      suggestions,
    };
  }
}

export class StepQualityValidator {
  validateStepImplementation(stepCode: string): ValidationResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    if (!stepCode || stepCode.trim().length === 0) {
      issues.push('Step implementation is empty');
      return { passed: false, score: 0, issues, warnings, suggestions };
    }

    const hasTryCatch = stepCode.includes('try') && stepCode.includes('catch');
    if (!hasTryCatch) {
      warnings.push('Missing try-catch error handling');
      score -= 15;
    } else {
      const hasThrow = stepCode.includes('throw');
      if (!hasThrow) {
        warnings.push('Catch block exists but does not throw meaningful error');
        score -= 10;
      }
    }

    const hasAwait = stepCode.includes('await');
    if (!hasAwait) {
      warnings.push('No "await" keyword found. Async operations may not be properly handled.');
      score -= 15;
    }

    const hasConsole = stepCode.includes('console.log');
    if (hasConsole) {
      suggestions.push('Remove console.log statements in production code');
      score -= 3;
    }

    const hasHardcodedValues = /['\"][a-zA-Z0-9._\-]+['\"]\s*\)/.test(stepCode);
    if (hasHardcodedValues) {
      suggestions.push('Consider parameterizing hardcoded values');
    }

    const hasMagicSleep = /pause\(|sleep\(|setTimeout\(/.test(stepCode);
    if (hasMagicSleep) {
      suggestions.push('Use explicit waits (waitUntil) instead of fixed pauses');
      score -= 10;
    }

    const hasExplicitWait = stepCode.includes('waitUntil') || stepCode.includes('expect');
    if (!hasExplicitWait) {
      warnings.push('No explicit waits found. Add waitUntil or expect() for stability');
      score -= 10;
    }

    const lines = stepCode.split('\n');
    if (lines.length > 30) {
      suggestions.push(
        'Step implementation is lengthy. Consider breaking into smaller helper functions'
      );
      score -= 5;
    } else if (lines.length < 2) {
      warnings.push('Step implementation is very short. May lack error handling or validation');
      score -= 10;
    }

    const braceBalance =
      (stepCode.match(/\{/g) || []).length === (stepCode.match(/\}/g) || []).length;
    if (!braceBalance) {
      issues.push('Braces are not balanced in step implementation');
      score -= 30;
    }

    const parenBalance =
      (stepCode.match(/\(/g) || []).length === (stepCode.match(/\)/g) || []).length;
    if (!parenBalance) {
      issues.push('Parentheses are not balanced in step implementation');
      score -= 30;
    }

    const hasSelector = /\$\(|$\[\(|browser\./g.test(stepCode);
    if (!hasSelector) {
      suggestions.push('No WebdriverIO selectors or browser commands found. Verify implementation');
    }

    const hasValidation = /expect\(|toEqual|toContain|toBe/.test(stepCode);
    if (!hasValidation && stepCode.includes('Then')) {
      warnings.push('No assertions found in Then step');
      score -= 10;
    }

    return {
      passed: issues.length === 0,
      score: Math.max(0, score),
      issues,
      warnings,
      suggestions,
    };
  }

  validateAllSteps(stepsCode: string): ValidationResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let score = 100;
    let totalScore = 0;
    let stepCount = 0;

    const stepMatches = stepsCode.match(/Given\(.*?\)|When\(.*?\)|Then\(.*?\)/g) || [];
    stepCount = stepMatches.length;

    if (stepCount === 0) {
      issues.push('No step definitions found');
      return { passed: false, score: 0, issues, warnings, suggestions };
    }

    const importCheck = stepsCode.includes('import');
    if (!importCheck) {
      warnings.push('No imports found in step definitions');
      score -= 10;
    }

    const hasDefaults = stepsCode.includes('DEFAULT_PARAMETERS');
    if (!hasDefaults) {
      suggestions.push('Consider using DEFAULT_PARAMETERS for test data consistency');
    }

    const hasComments = (stepsCode.match(/\/\//g) || []).length > 0;
    if (!hasComments) {
      suggestions.push('Add comments to explain complex step logic');
    }

    for (const match of stepMatches) {
      const result = this.validateStepImplementation(match);
      totalScore += result.score;
      issues.push(...result.issues);
      warnings.push(...result.warnings);
    }

    const averageScore = Math.round(totalScore / Math.max(stepCount, 1));
    const finalScore = Math.round((score + averageScore) / 2);

    return {
      passed: issues.length === 0,
      score: finalScore,
      issues,
      warnings,
      suggestions,
    };
  }
}

export const scenarioQualityValidator = new ScenarioQualityValidator();
export const stepQualityValidator = new StepQualityValidator();
