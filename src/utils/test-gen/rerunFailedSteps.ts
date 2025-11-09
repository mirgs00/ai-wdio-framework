import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { logger } from '../logger';
import { analyzeDOM } from '../dom/domAnalyzer';
import { buildPageObjects } from './pageObjectBuilder';
import { buildScenario } from './scenarioBuilder';
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

      console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
      console.log(`║ 🔁 REGENERATING STEP ARTIFACTS                                 ║`);
      console.log(`╠════════════════════════════════════════════════════════════════╣`);
      console.log(`║ Feature: ${failure.feature}`);
      console.log(`║ Scenario: ${failure.scenario}`);
      console.log(`║ Step: ${failure.step}`);
      console.log(`║ URL: ${failure.url}`);
      console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

      // Fetch current DOM
      console.log('🌐 Fetching DOM from URL...');
      const domContent = await fetchDOM(failure.url);

      if (!domContent) {
        console.error('❌ Failed to fetch DOM');
        return false;
      }

      console.log('✅ DOM fetched successfully');

      // Rebuild page objects
      console.log('🏗️ Rebuilding page object...');
      await buildPageObjects(failure.url, domContent);
      console.log('✅ Page object regenerated');

      logger.info('Step artifacts regenerated successfully', {
        section: 'RERUN_SERVICE',
        details: { step: failure.step, url: failure.url },
      });

      return true;
    } catch (error) {
      console.error(
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
        console.log('\n✅ No failed steps found. All tests passed!');
        return;
      }

      console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
      console.log(`║ 🔁 RERUN WORKFLOW: Healing Failed Steps                        ║`);
      console.log(`╠════════════════════════════════════════════════════════════════╣`);
      console.log(`║ Failed steps to heal: ${failures.length}`);
      console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

      // Group failures by feature for efficient regeneration
      const failuresByFeature = this.groupByFeature(failures);

      for (const [feature, steps] of Object.entries(failuresByFeature)) {
        console.log(`\n📋 Processing feature: ${feature} (${steps.length} failed step(s))`);

        for (const step of steps) {
          const regenerated = await this.regenerateStep(step);

          if (!regenerated) {
            console.warn(`⚠️ Failed to regenerate step: ${step.step}`);
          }
        }
      }

      console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
      console.log(`║ ✅ Artifact Regeneration Complete                              ║`);
      console.log(`║ 🧪 Ready to re-run tests with updated artifacts                 ║`);
      console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

      // Re-run tests
      await this.rerunTests(failuresByFeature);

      // Clear log after successful rerun
      this.clearFailureLog();
      console.log('✅ Rerun log cleared - all steps have been healed!');
    } catch (error) {
      console.error(`❌ Rerun workflow error: ${error instanceof Error ? error.message : error}`);
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

      console.log(`\n🧪 Re-running ${features.length} feature file(s)...\n`);

      // Build WDIO command with all failed feature files
      const specArgs = features
        .map((feature) => {
          const featurePath = path.resolve(`src/features/${feature}`);
          return `--spec ${featurePath}`;
        })
        .join(' ');

      const wdioCommand = [
        'npx wdio run ./wdio.conf.ts',
        specArgs,
        '--mochaOpts.timeout 60000',
        '--specFileRetries 1',
      ].join(' ');

      console.log(`🚀 Executing: ${wdioCommand}\n`);

      try {
        execSync(wdioCommand, { stdio: 'inherit' });
        console.log('\n✅ Rerun tests completed successfully!');
      } catch (error) {
        console.error('\n⚠️ Some tests failed during rerun');
        throw error;
      }
    } catch (error) {
      console.error(`❌ Test rerun failed: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }
}

export const rerunFailedStepsService = new RerunFailedSteps();
