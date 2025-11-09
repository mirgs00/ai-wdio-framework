export interface QualityIssue {
  type: 'warning' | 'error' | 'suggestion';
  message: string;
  location?: string;
  severity: 'low' | 'medium' | 'high';
}

export interface QualityReport {
  score: number;
  issueCount: number;
  issues: QualityIssue[];
  suggestions: string[];
  passedChecks: string[];
}

export class TestQualityChecker {
  private static readonly MAX_SCORE = 100;
  private static readonly HARDCODED_WAIT_PENALTY = 15;
  private static readonly MISSING_ASSERTIONS_PENALTY = 20;
  private static readonly TOO_MANY_SCENARIOS_PENALTY = 5;
  private static readonly MISSING_DATA_DRIVEN_PENALTY = 10;

  static analyzeTestQuality(scenarios: string, stepDefs: string): QualityReport {
    const issues: QualityIssue[] = [];
    const suggestions: string[] = [];
    const passedChecks: string[] = [];
    let score = TestQualityChecker.MAX_SCORE;

    score = this.checkForHardcodedWaits(stepDefs, score, issues, suggestions);
    score = this.checkForAssertions(stepDefs, score, issues, suggestions, passedChecks);
    score = this.checkScenarioOrganization(scenarios, score, issues, suggestions, passedChecks);
    score = this.checkForDataDriven(scenarios, score, issues, suggestions);
    score = this.checkForErrorHandling(stepDefs, score, issues, suggestions, passedChecks);
    score = this.checkForComments(stepDefs, score, issues, suggestions, passedChecks);
    score = this.checkForPageObjectUsage(stepDefs, score, issues, suggestions, passedChecks);

    return {
      score: Math.max(0, score),
      issueCount: issues.length,
      issues,
      suggestions,
      passedChecks,
    };
  }

  private static checkForHardcodedWaits(
    stepDefs: string,
    score: number,
    issues: QualityIssue[],
    suggestions: string[]
  ): number {
    const hardcodedWaitPatterns = [
      /await\s+browser\.pause\(/gi,
      /await\s+browser\.sleep\(/gi,
      /sleep\(/gi,
      /pause\(/gi,
    ];

    let hasHardcodedWaits = false;
    for (const pattern of hardcodedWaitPatterns) {
      if (pattern.test(stepDefs)) {
        hasHardcodedWaits = true;
        break;
      }
    }

    if (hasHardcodedWaits) {
      issues.push({
        type: 'error',
        severity: 'high',
        message: 'Hardcoded waits detected - Use explicit waits instead',
        location: 'Step Definitions',
      });
      suggestions.push(
        'Use explicit waits like waitForDisplayed(), waitForEnabled() instead of pause()/sleep()'
      );
      return score - TestQualityChecker.HARDCODED_WAIT_PENALTY;
    }

    return score;
  }

  private static checkForAssertions(
    stepDefs: string,
    score: number,
    issues: QualityIssue[],
    suggestions: string[],
    passedChecks: string[]
  ): number {
    const assertionPatterns = [/expect\(/gi, /assert\(/gi, /should\./gi, /toEqual\(/gi, /toBe\(/gi];

    const hasAssertions = assertionPatterns.some((pattern) => pattern.test(stepDefs));

    if (!hasAssertions) {
      issues.push({
        type: 'error',
        severity: 'high',
        message: 'No assertions found in step definitions',
        location: 'Step Definitions',
      });
      suggestions.push('Add proper assertions to verify test outcomes (use expect() or assert())');
      return score - TestQualityChecker.MISSING_ASSERTIONS_PENALTY;
    }

    passedChecks.push('✓ Assertions found in step definitions');
    return score;
  }

  private static checkScenarioOrganization(
    scenarios: string,
    score: number,
    issues: QualityIssue[],
    suggestions: string[],
    passedChecks: string[]
  ): number {
    const scenarioCount = (scenarios.match(/Scenario:/gi) || []).length;

    if (scenarioCount > 20) {
      issues.push({
        type: 'warning',
        severity: 'medium',
        message: `Too many scenarios (${scenarioCount}) in single file`,
        location: 'Feature File',
      });
      suggestions.push('Consider splitting into multiple feature files for better organization');
      return score - TestQualityChecker.TOO_MANY_SCENARIOS_PENALTY;
    }

    if (scenarioCount > 0) {
      passedChecks.push(`✓ Well-organized test scenarios (${scenarioCount} scenarios)`);
    }

    return score;
  }

  private static checkForDataDriven(
    scenarios: string,
    score: number,
    issues: QualityIssue[],
    suggestions: string[]
  ): number {
    const hasExamples = /Examples:/gi.test(scenarios);
    const scenarioCount = (scenarios.match(/Scenario:/gi) || []).length;

    if (!hasExamples && scenarioCount > 5) {
      issues.push({
        type: 'suggestion',
        severity: 'low',
        message: 'No data-driven tests found for repetitive test cases',
        location: 'Feature File',
      });
      suggestions.push('Consider using Scenario Outlines with Examples for data-driven testing');
      return score - TestQualityChecker.MISSING_DATA_DRIVEN_PENALTY;
    }

    return score;
  }

  private static checkForErrorHandling(
    stepDefs: string,
    score: number,
    issues: QualityIssue[],
    suggestions: string[],
    passedChecks: string[]
  ): number {
    const hasErrorHandling = /try\s*\{[\s\S]*?\}\s*catch/i.test(stepDefs);

    if (!hasErrorHandling) {
      issues.push({
        type: 'warning',
        severity: 'medium',
        message: 'No error handling (try-catch) found in step definitions',
        location: 'Step Definitions',
      });
      suggestions.push('Add proper error handling with try-catch blocks for robustness');
      return score - 10;
    }

    passedChecks.push('✓ Error handling implemented');
    return score;
  }

  private static checkForComments(
    stepDefs: string,
    score: number,
    issues: QualityIssue[],
    suggestions: string[],
    passedChecks: string[]
  ): number {
    const commentCount =
      (stepDefs.match(/\/\//g) || []).length + (stepDefs.match(/\/\*[\s\S]*?\*\//g) || []).length;

    if (commentCount === 0 && stepDefs.length > 500) {
      suggestions.push('Consider adding comments to explain complex logic');
    } else if (commentCount > 0) {
      passedChecks.push('✓ Documentation/comments present');
    }

    return score;
  }

  private static checkForPageObjectUsage(
    stepDefs: string,
    score: number,
    issues: QualityIssue[],
    suggestions: string[],
    passedChecks: string[]
  ): number {
    const usesPageObject = /generatedPage\.|page\.|this\.page/i.test(stepDefs);
    const usesDirectSelectors = /\$\(|findElement|querySelector/i.test(stepDefs);

    if (usesPageObject) {
      passedChecks.push('✓ Page Object pattern used');
      return score;
    }

    if (usesDirectSelectors) {
      issues.push({
        type: 'warning',
        severity: 'medium',
        message: 'Direct selector usage detected instead of page objects',
        location: 'Step Definitions',
      });
      suggestions.push('Refactor to use Page Objects for better maintainability');
      return score - 5;
    }

    return score;
  }

  static formatReport(report: QualityReport): string {
    const lines: string[] = [];
    lines.push('');
    lines.push('═════════════════════════════════════════');
    lines.push('          TEST QUALITY REPORT             ');
    lines.push('═════════════════════════════════════════');
    lines.push(`Score: ${report.score}/${TestQualityChecker.MAX_SCORE}`);
    lines.push(`Issues Found: ${report.issueCount}`);
    lines.push('');

    if (report.passedChecks.length > 0) {
      lines.push('✓ PASSED CHECKS:');
      report.passedChecks.forEach((check) => lines.push(`  ${check}`));
      lines.push('');
    }

    if (report.issues.length > 0) {
      lines.push('⚠ ISSUES:');
      report.issues.forEach((issue) => {
        const icon = issue.type === 'error' ? '✗' : '⚡';
        lines.push(`  ${icon} [${issue.severity.toUpperCase()}] ${issue.message}`);
        if (issue.location) {
          lines.push(`     Location: ${issue.location}`);
        }
      });
      lines.push('');
    }

    if (report.suggestions.length > 0) {
      lines.push('💡 SUGGESTIONS:');
      report.suggestions.forEach((suggestion) => lines.push(`  • ${suggestion}`));
      lines.push('');
    }

    lines.push('═════════════════════════════════════════');
    lines.push('');

    return lines.join('\n');
  }
}
