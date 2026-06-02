import { HealingService } from './healingService';
import { TestFailureTracker } from '../test-gen/testFailureTracker';
import { logger } from '../logger';
import * as path from 'path';
import * as fs from 'fs';

export interface WorkflowStep {
  name: string;
  status: 'pending' | 'in_progress' | 'success' | 'failed';
  details?: Record<string, unknown>;
}

export interface HealingWorkflowReport {
  startTime: number;
  endTime: number;
  duration: number;
  steps: WorkflowStep[];
  preExecutionValidation: {
    totalSelectors: number;
    validSelectors: number;
    brokenSelectors: number;
    successRate: number;
  };
  failureRecovery: {
    totalFailures: number;
    healed: number;
    stillBroken: number;
    successRate: number;
  };
  overallSuccessRate: number;
  summary: string;
}

export class HealingWorkflow {
  private healingService: HealingService;
  private steps: WorkflowStep[] = [];
  private startTime: number = 0;

  constructor(pageObjectsDir: string = path.resolve('src/page-objects')) {
    this.healingService = new HealingService(pageObjectsDir);
  }

  /**
   * Runs the complete healing workflow
   */
  async executeWorkflow(): Promise<HealingWorkflowReport> {
    this.startTime = Date.now();
    this.steps = [];

    try {
      await this.step('Pre-Execution Validation', () => this.preExecutionValidation());

      await this.step('Failure Detection & Recovery', () => this.failureDetectionAndRecovery());

      await this.step('Generate Healing Report', () => this.generateReport());

      return this.buildWorkflowReport('success');
    } catch (error) {
      logger.warn('Healing workflow encountered an error', {
        section: 'HEALING_WORKFLOW',
        details: { error: error instanceof Error ? error.message : String(error) },
      });

      return this.buildWorkflowReport('failed');
    }
  }

  /**
   * Pre-execution validation: Check all selectors before tests run
   */
  private async preExecutionValidation(): Promise<void> {
    try {
      logger.info('Starting pre-execution selector validation...', {
        section: 'HEALING_WORKFLOW',
      });

      // Find all page objects
      const pageObjectFiles = this.findPageObjectFiles();

      if (pageObjectFiles.length === 0) {
        throw new Error('No page objects found for validation');
      }

      let totalSelectors = 0;
      let validSelectors = 0;
      let brokenSelectors = 0;

      for (const file of pageObjectFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const getterRegex = /(?:public\s+)?get\s+(\w+)\s*\(\s*\)[^{]*\{\s*return\s+\$\([']([^']*)[']\)/g;

        let match;
        while ((match = getterRegex.exec(content)) !== null) {
          totalSelectors++;
          const getterName = match[1];
          const selector = match[2];

          // Validate selector syntax
          const validation = this.validateSelector(selector);
          if (validation.valid) {
            validSelectors++;
          } else {
            brokenSelectors++;
            logger.warn(`Invalid selector found: ${selector}`, {
              section: 'HEALING_WORKFLOW',
              details: { getter: getterName, issues: validation.issues },
            });
          }
        }
      }

      this.recordStep('Pre-Execution Validation', 'success', {
        totalSelectors,
        validSelectors,
        brokenSelectors,
        successRate: totalSelectors > 0 ? (validSelectors / totalSelectors) * 100 : 0,
      });

      logger.info(
        `Pre-execution validation completed: ${validSelectors}/${totalSelectors} selectors valid`,
        {
          section: 'HEALING_WORKFLOW',
        }
      );
    } catch (error) {
      this.recordStep('Pre-Execution Validation', 'failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Failure detection and recovery: Heal broken selectors from last test run
   */
  private async failureDetectionAndRecovery(): Promise<void> {
    try {
      const failureReport = TestFailureTracker.getFailureReport();

      if (failureReport.failures.length === 0) {
        this.recordStep('Failure Detection & Recovery', 'success', {
          totalFailures: 0,
          healed: 0,
          stillBroken: 0,
          successRate: 100,
        });

        logger.info('No failures detected from last test run', {
          section: 'HEALING_WORKFLOW',
        });
        return;
      }

      logger.info(`Found ${failureReport.failures.length} failed tests to heal`, {
        section: 'HEALING_WORKFLOW',
      });

      let healedCount = 0;
      const healingResults: Array<{ failure: string; healed: boolean }> = [];

      for (const failure of failureReport.failures) {
        try {
          const pageName = this.extractPageNameFromFailure(failure.featureName);
          const pageObjPath = path.resolve(
            `src/page-objects/generated${pageName.charAt(0).toUpperCase() + pageName.slice(1)}Page.ts`
          );

          if (!fs.existsSync(pageObjPath)) {
            logger.warn(`Page object not found for healing: ${pageObjPath}`, {
              section: 'HEALING_WORKFLOW',
            });
            healingResults.push({
              failure: `${failure.featureName}:${failure.scenario}`,
              healed: false,
            });
            continue;
          }

          const content = fs.readFileSync(pageObjPath, 'utf-8');
          const getterRegex = /(?:public\s+)?get\s+(\w+)\s*\(\s*\)[^{]*\{\s*return\s+\$\([']([^']*)[']\)/g;
          const selectors: string[] = [];
          let match;
          while ((match = getterRegex.exec(content)) !== null) {
            selectors.push(match[2]);
          }

          if (selectors.length === 0) {
            healingResults.push({
              failure: `${failure.featureName}:${failure.scenario}`,
              healed: false,
            });
            continue;
          }

          const healings: Record<string, import('./healingService').SelectorHealing> = {};
          let pageHealedCount = 0;

          for (const selector of selectors) {
            const healing = await this.healingService.healBrokenSelector(selector);
            healings[selector] = healing;
            if (healing.healed) {
              pageHealedCount++;
            }
          }

          if (pageHealedCount > 0) {
            await this.healingService.updatePageObjectWithHealedSelectors(pageName, healings);
          }

          healedCount += pageHealedCount;
          healingResults.push({
            failure: `${failure.featureName}:${failure.scenario}`,
            healed: pageHealedCount > 0,
          });

          if (pageHealedCount > 0) {
            logger.info(`Healed ${pageHealedCount}/${selectors.length} selectors on page ${pageName}`, {
              section: 'HEALING_WORKFLOW',
              details: { pageName, healedCount: pageHealedCount, totalSelectors: selectors.length },
            });
          } else {
            logger.warn(`Could not heal any selectors on page ${pageName}`, {
              section: 'HEALING_WORKFLOW',
              details: { pageName },
            });
          }
        } catch (error) {
          healingResults.push({
            failure: `${failure.featureName}:${failure.scenario}`,
            healed: false,
          });

          logger.warn(`Error healing failure`, {
            section: 'HEALING_WORKFLOW',
            details: { error: error instanceof Error ? error.message : String(error) },
          });
        }
      }

      const successRate =
        failureReport.failures.length > 0 ? (healedCount / failureReport.failures.length) * 100 : 0;

      this.recordStep('Failure Detection & Recovery', 'success', {
        totalFailures: failureReport.failures.length,
        healed: healedCount,
        stillBroken: failureReport.failures.length - healedCount,
        successRate,
        details: healingResults,
      });

      logger.info(
        `Healing completed: ${healedCount}/${failureReport.failures.length} failures recovered`,
        {
          section: 'HEALING_WORKFLOW',
        }
      );
    } catch (error) {
      this.recordStep('Failure Detection & Recovery', 'failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Generate healing report with detailed metrics
   */
  private async generateReport(): Promise<void> {
    try {
      const preValidationStep = this.steps.find((s) => s.name === 'Pre-Execution Validation');
      const recoveryStep = this.steps.find((s) => s.name === 'Failure Detection & Recovery');

      const preDetails = preValidationStep?.details || {};
      const recoveryDetails = recoveryStep?.details || {};

      const summary = `Pre-Execution: ${String(preDetails.validSelectors || 0)}/${String(preDetails.totalSelectors || 0)} selectors valid. ` +
        `Recovery: ${String(recoveryDetails.healed || 0)}/${String(recoveryDetails.totalFailures || 0)} failures healed.`;

      this.recordStep('Generate Healing Report', 'success', {
        totalValidSelectors: preDetails.validSelectors || 0,
        totalBrokenSelectors: preDetails.brokenSelectors || 0,
        totalFailures: recoveryDetails.totalFailures || 0,
        healedCount: recoveryDetails.healed || 0,
        stillBroken: recoveryDetails.stillBroken || 0,
        summary,
      });

      logger.info('Healing report generated', { section: 'HEALING_WORKFLOW', details: { summary } });
    } catch (error) {
      this.recordStep('Generate Healing Report', 'failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Helper: Find all page object files
   */
  private findPageObjectFiles(): string[] {
    const pageObjectsDir = path.resolve('src/page-objects');

    if (!fs.existsSync(pageObjectsDir)) {
      return [];
    }

    return fs
      .readdirSync(pageObjectsDir)
      .filter((f: string) => f.startsWith('generated') && f.endsWith('.ts'))
      .map((f: string) => path.join(pageObjectsDir, f));
  }

  /**
   * Helper: Validate selector syntax
   */
  private validateSelector(selector: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for empty selectors
    if (!selector || selector.trim().length === 0) {
      issues.push('Empty selector');
      return { valid: false, issues };
    }

    // Check for syntax errors
    if (selector.includes('undefined') || selector.includes('null')) {
      issues.push('Selector contains undefined or null');
    }

    // Check for balanced quotes
    const quotes = (selector.match(/["'`]/g) || []).length;
    if (quotes % 2 !== 0) {
      issues.push('Unbalanced quotes in selector');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Helper: Record a workflow step
   */
  private recordStep(
    name: string,
    status: 'pending' | 'in_progress' | 'success' | 'failed',
    details?: Record<string, unknown>
  ): void {
    this.steps.push({
      name,
      status,
      details,
    });
  }

  /**
   * Helper: Execute a step with status tracking
   */
  private async step(name: string, fn: () => Promise<void>): Promise<void> {
    this.recordStep(name, 'in_progress');
    await fn();
  }

  /**
   * Helper: Extract page name from feature name
   */
  private extractPageNameFromFailure(featureName: string): string {
    return featureName
      .toLowerCase()
      .replace(/[_\s]/g, '')
      .replace(/page|test|scenario/gi, '')
      .replace(/^generated/, '');
  }

  /**
   * Helper: Build final workflow report
   */
  private buildWorkflowReport(finalStatus: 'success' | 'failed'): HealingWorkflowReport {
    const endTime = Date.now();
    const duration = endTime - this.startTime;

    const preValidationStep = [...this.steps].reverse().find((s) => s.name === 'Pre-Execution Validation');
    const recoveryStep = [...this.steps].reverse().find((s) => s.name === 'Failure Detection & Recovery');

    const preExecution = (preValidationStep?.details || {
      totalSelectors: 0,
      validSelectors: 0,
      brokenSelectors: 0,
      successRate: 0,
    }) as HealingWorkflowReport['preExecutionValidation'];

    const recovery = (recoveryStep?.details || {
      totalFailures: 0,
      healed: 0,
      stillBroken: 0,
      successRate: 0,
    }) as HealingWorkflowReport['failureRecovery'];

    const overallSuccessRate = (preExecution.successRate + recovery.successRate) / 2;

    const summary = this.generateSummary(finalStatus, preExecution, recovery, overallSuccessRate);

    return {
      startTime: this.startTime,
      endTime,
      duration,
      steps: this.steps,
      preExecutionValidation: preExecution,
      failureRecovery: recovery,
      overallSuccessRate,
      summary,
    };
  }

  /**
   * Helper: Generate summary text
   */
  private generateSummary(
    status: 'success' | 'failed',
    preExecution: HealingWorkflowReport['preExecutionValidation'],
    recovery: HealingWorkflowReport['failureRecovery'],
    overallSuccessRate: number
  ): string {
    if (status === 'failed') {
      return 'Healing workflow encountered errors. Check logs for details.';
    }

    const lines = [
      `✅ Healing Workflow Completed Successfully`,
      `📊 Overall Success Rate: ${overallSuccessRate.toFixed(1)}%`,
      ``,
      `Pre-Execution Validation:`,
      `  • Total Selectors Validated: ${preExecution.totalSelectors}`,
      `  • Valid Selectors: ${preExecution.validSelectors}`,
      `  • Broken Selectors: ${preExecution.brokenSelectors}`,
      ``,
      `Failure Recovery:`,
      `  • Total Failures Detected: ${recovery.totalFailures}`,
      `  • Successfully Healed: ${recovery.healed}`,
      `  • Still Broken: ${recovery.stillBroken}`,
      `  • Healing Success Rate: ${recovery.successRate.toFixed(1)}%`,
    ];

    return lines.join('\n');
  }
}

export const defaultHealingWorkflow = new HealingWorkflow();
