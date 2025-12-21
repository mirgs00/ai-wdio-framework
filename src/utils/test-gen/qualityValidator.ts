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

    // Check for try-catch (more flexible pattern)
    const hasTryCatch = /try\s*\{[\s\S]*?\}\s*catch/i.test(stepCode);
    if (!hasTryCatch) {
      warnings.push('Missing try-catch error handling');
      score -= 15;
    }

    // Check for await keyword
    const hasAwait = /await\s+/i.test(stepCode);
    if (!hasAwait) {
      warnings.push('No "await" keyword found. Async operations may not be properly handled.');
      score -= 15;
    }

    // Check for explicit waits or expectations
    const hasExplicitWait = /expect\(|waitUntil|waitForDisplayed|toBeDisplayed|toContain/i.test(stepCode);
    if (!hasExplicitWait) {
      warnings.push('No explicit waits found. Add waitUntil or expect() for stability');
      score -= 10;
    }

    // Check for console.log (should be minimal)
    const consoleCount = (stepCode.match(/console\.log/g) || []).length;
    if (consoleCount > 2) {
      suggestions.push('Too many console.log statements - consider reducing for production');
      score -= 3;
    }

    // Check for hardcoded pauses (bad practice)
    const hasMagicSleep = /pause\(\d+\)|sleep\(\d+\)|setTimeout\(/i.test(stepCode);
    if (hasMagicSleep) {
      suggestions.push('Use explicit waits (waitUntil) instead of fixed pauses');
      score -= 10;
    }

    // Check for proper WebdriverIO syntax
    const hasWebdriverIO = /\$\(|browser\.|generatedPage\.|expect\(/i.test(stepCode);
    if (!hasWebdriverIO) {
      suggestions.push('No WebdriverIO commands found. Verify implementation uses proper syntax');
      score -= 5;
    }

    // Check for proper error handling in catch blocks
    if (hasTryCatch) {
      const hasProperErrorHandling = /throw new Error|throw error/i.test(stepCode);
      if (!hasProperErrorHandling) {
        warnings.push('Catch block should throw meaningful errors');
        score -= 5;
      }
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


