import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { quote } from 'shell-quote';
import { logger } from '../logger';
import { buildPageObjects } from './pageObjectBuilder';
import { fetchDOM } from '../dom/domParser';

export interface FailedStep {
  feature: string;
  scenario: string;
  step: string;
  url: string;
  timestamp?: string;
  errorMessage?: string;
  pageName?: string;
}

export class RerunFailedSteps {
  private rerunLogPath = path.resolve('.rerun-log.json');

  /**
   * Read failed steps from the rerun log
   */
  private readFailureLog(): FailedStep[] {
    try {
      if (!fs.existsSync(this.rerunLogPath)) {
        logger.info('No rerun log found', { section: 'RERUN_SERVICE' });
        return [];
      }

      const logData = fs.readFileSync(this.rerunLogPath, 'utf-8');
      return JSON.parse(logData);
    } catch (error) {
      logger.error('Failed to read rerun log', error as Error);
      return [];
    }
  }

  /**
   * Write failed steps to the rerun log
   */
  private writeFailureLog(failures: FailedStep[]): void {
    try {
      fs.writeFileSync(this.rerunLogPath, JSON.stringify(failures, null, 2));
      logger.info(`Logged ${failures.length} failed steps for rerun`, {
        section: 'RERUN_SERVICE',
      });
    } catch (error) {
      logger.error('Failed to write rerun log', error as Error);
    }
  }

  /**
   * Add a failed step to the rerun log
   */
  recordFailedStep(failure: FailedStep): void {
    const failures = this.readFailureLog();
    failure.timestamp = new Date().toISOString();

    const existingIndex = failures.findIndex(
      (f) =>
        f.feature === failure.feature && f.scenario === failure.scenario && f.step === failure.step
    );

    if (existingIndex >= 0) {
      failures[existingIndex] = failure;
    } else {
      failures.push(failure);
    }

    this.writeFailureLog(failures);
  }

  /**
   * Clear all failed steps from the log
   */
  clearFailureLog(): void {
    try {
      if (fs.existsSync(this.rerunLogPath)) {
        fs.unlinkSync(this.rerunLogPath);
        logger.info('Cleared rerun log', { section: 'RERUN_SERVICE' });
      }
    } catch (error) {
      logger.error('Failed to clear rerun log', error as Error);
    }
  }

  /**
   * Regenerate artifacts for a failed step
   * - Re-analyze the DOM from the URL
   * - Regenerate page object
   * - Regenerate step definition
   */
  async regenerateStep(failure: FailedStep): Promise<boolean> {
    try {
      logger.info(`🔁 Healing and regenerating: ${failure.step}`, {
        section: 'RERUN_SERVICE',
        details: {
          scenario: failure.scenario,
          step: failure.step,
          url: failure.url,
        } as Record<string, unknown>,
      });

      logger.info(`\n╔════════════════════════════════════════════════════════════════╗`);
      logger.info(`║ 🔁 REGENERATING STEP ARTIFACTS                                 ║`);
      logger.info(`╠════════════════════════════════════════════════════════════════╣`);
      logger.info(`║ Feature: ${failure.feature}`);
      logger.info(`║ Scenario: ${failure.scenario}`);
      logger.info(`║ Step: ${failure.step}`);
      logger.info(`║ URL: ${failure.url}`);
      logger.info(`╚════════════════════════════════════════════════════════════════╝\n`);

      // Fetch current DOM
      logger.info('🌐 Fetching DOM from URL...');
      const domContent = await fetchDOM(failure.url);

      if (!domContent) {
        logger.error('❌ Failed to fetch DOM');
        return false;
      }

      logger.info('✅ DOM fetched successfully');

      // Rebuild page objects
      logger.info('🏗️ Rebuilding page object...');
      await buildPageObjects(failure.url, domContent);
      logger.info('✅ Page object regenerated');

      logger.info('Step artifacts regenerated successfully', {
        section: 'RERUN_SERVICE',
        details: { step: failure.step, url: failure.url },
      });

      return true;
    } catch (error) {
      logger.error(
        `❌ Failed to regenerate step: ${error instanceof Error ? error.message : error}`
      );
      logger.error(`Failed to regenerate step: ${failure.step}`, error as Error);
      return false;
    }
  }

  /**
   * Execute rerun workflow:
   * 1. Read failed steps from log
   * 2. Regenerate artifacts for each failed step
   * 3. Re-run the tests
   */
  async executeRerun(): Promise<void> {
    try {
      const failures = this.readFailureLog();

      if (failures.length === 0) {
        logger.info('\n✅ No failed steps found. All tests passed!');
        return;
      }

      logger.info(`\n╔════════════════════════════════════════════════════════════════╗`);
      logger.info(`║ 🔁 RERUN WORKFLOW: Healing Failed Steps                        ║`);
      logger.info(`╠════════════════════════════════════════════════════════════════╣`);
      logger.info(`║ Failed steps to heal: ${failures.length}`);
      logger.info(`╚════════════════════════════════════════════════════════════════╝\n`);

      // Group failures by feature for efficient regeneration
      const failuresByFeature = this.groupByFeature(failures);

      for (const [feature, steps] of Object.entries(failuresByFeature)) {
        logger.info(`\n📋 Processing feature: ${feature} (${steps.length} failed step(s))`);

        for (const step of steps) {
          const regenerated = await this.regenerateStep(step);

          if (!regenerated) {
            logger.warn(`⚠️ Failed to regenerate step: ${step.step}`);
          }
        }
      }

      logger.info(`\n╔════════════════════════════════════════════════════════════════╗`);
      logger.info(`║ ✅ Artifact Regeneration Complete                              ║`);
      logger.info(`║ 🧪 Ready to re-run tests with updated artifacts                 ║`);
      logger.info(`╚════════════════════════════════════════════════════════════════╝\n`);

      // Re-run tests
      await this.rerunTests(failuresByFeature);

      // Clear log after successful rerun
      this.clearFailureLog();
      logger.info('✅ Rerun log cleared - all steps have been healed!');
    } catch (error) {
      logger.error(`❌ Rerun workflow error: ${error instanceof Error ? error.message : error}`);
      logger.error('Rerun workflow failed', error as Error);
      throw error;
    }
  }

  /**
   * Group failed steps by feature file
   */
  private groupByFeature(failures: FailedStep[]): Record<string, FailedStep[]> {
    return failures.reduce(
      (acc, failure) => {
        if (!acc[failure.feature]) {
          acc[failure.feature] = [];
        }
        acc[failure.feature].push(failure);
        return acc;
      },
      {} as Record<string, FailedStep[]>
    );
  }

  /**
   * Re-run the tests using WDIO
   */
  private async rerunTests(failuresByFeature: Record<string, FailedStep[]>): Promise<void> {
    try {
      const features = Object.keys(failuresByFeature);

      logger.info(`\n🧪 Re-running ${features.length} feature file(s)...\n`);

      // Build WDIO args array (no shell interpolation = no command injection)
      const specArgs = features.flatMap((feature) => {
        const featurePath = path.resolve(`src/features/${feature}`);
        return ['--spec', featurePath];
      });

      const wdioArgs = [
        'run', './wdio.conf.ts',
        ...specArgs,
        '--mochaOpts.timeout', '60000',
        '--specFileRetries', '1',
      ];

      logger.info(`🚀 Executing: npx wdio ${wdioArgs.join(' ')}\n`);

      try {
        execSync(`npx wdio ${quote(wdioArgs)}`, { stdio: 'inherit' });
        logger.info('\n✅ Rerun tests completed successfully!');
      } catch (error) {
        logger.error('\n⚠️ Some tests failed during rerun');
        throw error;
      }
    } catch (error) {
      logger.error(`❌ Test rerun failed: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }
}

export const rerunFailedStepsService = new RerunFailedSteps();
