#!/usr/bin/env ts-node
// Load environment variables from .env file
let dotenv: any;
try {
  dotenv = require('dotenv');
  dotenv.config();
} catch {
  console.warn('Warning: dotenv not fully loaded, continuing without .env support');
}

import * as path from 'path';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { quote } from 'shell-quote';
import { TestGenerationService } from './services/TestGenerationService';
import { TestRunnerService } from './services/TestRunnerService';
import { SelectorValidationService } from './services/SelectorValidationService';
import { validateEnvironment } from './utils/environment';
import { parseArgs } from './utils/args';
import { TestGenerationConfig } from './types';
import { InputValidator } from './utils/validation';
import { TestFailureTracker } from './utils/test-gen/testFailureTracker';
import { DuplicateGetterDetector } from './utils/test-gen/duplicateGetterDetector';
import { HealingWorkflow } from './utils/healing/healingWorkflow';
import { rerunFailedStepsService } from './utils/test-gen/rerunFailedSteps';
import { TIMEOUTS } from './utils/constants';

// Services
const testGenerationService = new TestGenerationService();
const testRunnerService = new TestRunnerService();
const selectorValidationService = new SelectorValidationService();

/**
 * Executes the comprehensive healing workflow
 */
async function executeHealingWorkflow(): Promise<void> {
  try {
    console.log('\n🔧 Starting comprehensive healing workflow...\n');

    const workflow = new HealingWorkflow();
    const report = await workflow.executeWorkflow();

    console.log(report.summary);
    console.log(`\n⏱️ Workflow completed in ${report.duration}ms\n`);

    if (report.steps.length > 0) {
      console.log('📋 Workflow Steps:');
      for (const step of report.steps) {
        const icon = step.status === 'success' ? '✅' : step.status === 'failed' ? '❌' : '⏳';
        console.log(`  ${icon} ${step.name}`);
      }
    }

    console.log('');
  } catch (error) {
    console.error('❌ Healing workflow error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Checks for and optionally fixes duplicate getters in page objects
 */
async function checkDuplicateGetters(fix: boolean = false): Promise<void> {
  try {
    const pageObjectsDir = path.resolve('src/page-objects');

    if (!existsSync(pageObjectsDir)) {
      console.error('❌ No page objects found. Please generate tests first.');
      process.exit(1);
    }

    console.log('\n🔍 Checking for duplicate getters in page objects...\n');

    const reports = DuplicateGetterDetector.analyzePageObjects(pageObjectsDir);

    if (reports.length === 0) {
      console.error('❌ No page objects found.');
      process.exit(1);
    }

    const formattedReport = DuplicateGetterDetector.generateReport(reports);
    console.log(formattedReport);

    const reportsWithDuplicates = reports.filter((r) => r.hasDuplicates);

    if (reportsWithDuplicates.length === 0) {
      console.log('✅ All page objects are clean!\n');
      process.exit(0);
    }

    if (fix) {
      console.log('🔧 Fixing duplicate getters...\n');

      for (const report of reportsWithDuplicates) {
        const result = DuplicateGetterDetector.fixDuplicates(report.filePath, true);
        console.log(`  ${result.message}`);
      }

      console.log('\n✅ Duplicate getter fixes completed!\n');
    } else {
      console.log(
        '\n💡 To fix these duplicates automatically, run: ts-node src/cli.ts --check-duplicates --fix\n'
      );
    }

    process.exit(0);
  } catch (error) {
    console.error(
      '❌ Duplicate getter check error:',
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}

/**
 * Re-runs failed tests from the last test execution
 */
async function rerunFailedTests(config: TestGenerationConfig = {}): Promise<void> {
  try {
    const failureReport = TestFailureTracker.getFailureReport();

    if (failureReport.failures.length === 0) {
      console.log('\n✅ No failed tests found. All tests passed in the last run!');
      process.exit(0);
    }

    console.log('\n🔄 Re-running failed tests...');
    console.log(`📊 Failed tests to re-run: ${failureReport.failures.length}`);

    failureReport.failures.forEach((failure, index) => {
      console.log(`  ${index + 1}. ${failure.featureName} > ${failure.scenario}`);
    });

    const instructionsPath = 'instructions.json';

    if (!existsSync(instructionsPath)) {
      console.error('\n❌ Instructions file not found. Cannot re-run failed tests.');
      console.error(
        '   Please run test generation first with: ts-node src/cli.ts --instructions instructions.json'
      );
      process.exit(1);
    }

    console.log('\n🔄 Re-generating test artifacts from instructions...');
    const { featureFilePath } = await testGenerationService.generateArtifactsFromInstructions(instructionsPath, config);

    console.log('\n🧪 Re-running failed tests...');

    const failedFeatures = failureReport.failures
      .map((f) => `src/features/${f.featureName.toLowerCase().replace(/\s+/g, '_')}.feature`)
      .filter((f, index, arr) => arr.indexOf(f) === index);

    const specArgs = failedFeatures.flatMap((f) => ['--spec', path.resolve(f)]);
    const timeout = String(config.testTimeout || TIMEOUTS.DEFAULT_TEST_TIMEOUT);
    const wdioArgs = [
      'run', './wdio.conf.ts',
      ...specArgs,
      '--mochaOpts.timeout', timeout,
      '--specFileRetries', '1',
    ];

    console.log(`🚀 Test command: npx wdio ${wdioArgs.join(' ')}`);

    try {
      execSync(`npx wdio ${quote(wdioArgs)}`, { stdio: 'inherit' });
      console.log('\n✅ Failed tests re-run completed successfully!');
      TestFailureTracker.clearFailures();
    } catch (error) {
      console.error(
        '\n❌ Re-run test execution failed:',
        error instanceof Error ? error.message : error
      );
      throw error;
    }
  } catch (error) {
    console.error('\n❌ Failed test re-run error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Rerun failed steps with artifact regeneration
 * Uses .rerun-log.json to track failed steps
 */
async function rerunFailedStepsWithHealing(): Promise<void> {
  try {
    await rerunFailedStepsService.executeRerun();
  } catch (error) {
    console.error('❌ Failed step rerun error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function main() {
  const parsedArgs = parseArgs(process.argv.slice(2));
  const shouldRunTests = parsedArgs['run'] !== false;
  const shouldValidate = parsedArgs['validate'];
  const shouldRerun = parsedArgs['rerun'];
  const shouldRerunSteps = parsedArgs['rerun-steps'];
  const shouldCheckDuplicates = parsedArgs['check-duplicates'];
  const shouldFixDuplicates = parsedArgs['fix'];
  const shouldRunHealing = parsedArgs['healing'];

  const config: TestGenerationConfig = {
    ollamaModel: typeof parsedArgs['model'] === 'string' ? parsedArgs['model'] : undefined,
    testTimeout: InputValidator.validateTimeout(
      typeof parsedArgs['timeout'] === 'string' ? parsedArgs['timeout'] : undefined
    ),
    screenshotOnFailure: parsedArgs['screenshots'] !== false,
  };

  try {
    // Handle --validate flag (standalone, no test generation)
    if (shouldValidate) {
      validateEnvironment();
      await selectorValidationService.validateSelectors();
      process.exit(0);
    }

    // Handle --rerun flag (standalone, re-run failed tests)
    if (shouldRerun) {
      validateEnvironment();
      await rerunFailedTests(config);
      process.exit(0);
    }

    // Handle --rerun-steps flag (standalone, rerun failed steps with healing)
    if (shouldRerunSteps) {
      validateEnvironment();
      await rerunFailedStepsWithHealing();
      process.exit(0);
    }

    // Handle --check-duplicates flag (standalone, check for duplicate getters)
    if (shouldCheckDuplicates) {
      validateEnvironment();
      await checkDuplicateGetters(shouldFixDuplicates as boolean);
      process.exit(0);
    }

    // Handle --healing flag (standalone, execute healing workflow)
    if (shouldRunHealing) {
      validateEnvironment();
      await executeHealingWorkflow();
      process.exit(0);
    }

    validateEnvironment();

    // Check if using instructions file
    if (parsedArgs['instructions']) {
      const instructionsPath =
        typeof parsedArgs['instructions'] === 'string'
          ? parsedArgs['instructions']
          : 'instructions.json';

      console.log(
        [
          `🚀 Starting AI-powered test generation from instructions`,
          `📄 Instructions file: ${instructionsPath}`,
          `🤖 Model: ${config.ollamaModel || 'llama3'}`,
          `⏱️ Timeout: ${config.testTimeout}ms`,
          `🏃‍♂️ Run tests: ${shouldRunTests ? 'Yes' : 'No'}`,
          `📸 Screenshots: ${config.screenshotOnFailure ? 'On failure' : 'Disabled'}`,
        ].join('\n')
      );

      const { featureFilePath } = await testGenerationService.generateArtifactsFromInstructions(
        instructionsPath,
        config
      );

      if (shouldRunTests) {
        testRunnerService.runTests(featureFilePath, config.testTimeout);
      } else {
        console.log('\n⏭️ Skipping test execution (--no-run flag set)');
      }
    } else {
      // Original URL + instruction mode
      const [url, ...instructionParts] = process.argv
        .slice(2)
        .filter((arg) => !arg.startsWith('--'));

      if (!url || instructionParts.length === 0) {
        console.error(
          [
            '❌ Usage:',
            '  Mode 1 - URL + Instruction:',
            '    ts-node src/cli.ts <url> "<test instruction>" [options]',
            '',
            '  Mode 2 - Instructions file:',
            '    ts-node src/cli.ts --instructions [<path>] [options]',
            '',
            '  Mode 3 - Validate Selectors:',
            '    ts-node src/cli.ts --validate',
            '',
            '  Mode 4 - Re-run Failed Tests:',
            '    ts-node src/cli.ts --rerun [options]',
            '',
            '  Mode 5 - Rerun Failed Steps with Healing:',
            '    ts-node src/cli.ts --rerun-steps',
            '',
            '  Mode 6 - Check Duplicate Getters:',
            '    ts-node src/cli.ts --check-duplicates [--fix]',
            '',
            '  Mode 7 - Run Healing Workflow:',
            '    ts-node src/cli.ts --healing',
            '',
            'Options:',
            '  --model <model>      Ollama model to use (default: llama3)',
            '  --timeout <ms>       Test timeout in milliseconds (default: 60000)',
            '  --no-run             Generate tests without executing them',
            '  --validate           Dry-run: Check if all selectors exist in DOM',
            '  --rerun              Re-run failed tests from last execution',
            '  --rerun-steps        Rerun failed steps with artifact regeneration',
            '  --check-duplicates   Check for duplicate getters in page objects',
            '  --fix                Fix duplicate getters (auto-merge selectors)',
            '  --healing            Execute comprehensive healing workflow',
            '',
            'Examples:',
            '  ts-node src/cli.ts https://example.com "Test login" --model llama3',
            '  ts-node src/cli.ts --instructions instructions.json --no-run',
            '  ts-node src/cli.ts --instructions ./custom-instructions.json',
            '  ts-node src/cli.ts --validate',
            '  ts-node src/cli.ts --rerun',
            '  ts-node src/cli.ts --rerun-steps',
            '  ts-node src/cli.ts --check-duplicates',
            '  ts-node src/cli.ts --check-duplicates --fix',
            '  ts-node src/cli.ts --healing',
          ].join('\n')
        );
        process.exit(1);
      }

      const validatedUrl = InputValidator.validateURL(url);
      const instruction = InputValidator.sanitizePrompt(instructionParts.join(' '));

      console.log(
        [
          `🚀 Starting AI-powered test generation`,
          `📌 URL: ${validatedUrl}`,
          `📝 Instruction: ${instruction}`,
          `🤖 Model: ${config.ollamaModel || 'llama3'}`,
          `⏱️ Timeout: ${config.testTimeout}ms`,
          `🏃‍♂️ Run tests: ${shouldRunTests ? 'Yes' : 'No'}`,
          `📸 Screenshots: ${config.screenshotOnFailure ? 'On failure' : 'Disabled'}`,
        ].join('\n')
      );

      const { featureFilePath } = await testGenerationService.generateTestArtifacts(
        validatedUrl,
        instruction,
        config
      );

      if (shouldRunTests) {
        testRunnerService.runTests(featureFilePath, config.testTimeout);
      } else {
        console.log('\n⏭️ Skipping test execution (--no-run flag set)');
      }
    }

    console.log('\n🎉 Test generation completed successfully!');
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
