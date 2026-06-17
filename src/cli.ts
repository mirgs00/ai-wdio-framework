#!/usr/bin/env ts-node
// Load environment variables from .env file
let dotenv: { config: () => void };
try {
  dotenv = require('dotenv');
  dotenv.config();
} catch {
  logger.warn('dotenv not fully loaded, continuing without .env support');
}

import * as path from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { quote } from 'shell-quote';
import { TestGenerationService } from './services/TestGenerationService';
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
import { discoverAndGenerate } from './utils/flow-matrix/flowMatrixBuilder';
import { buildPageObjectsFromStates } from './utils/test-gen/pageObjectBuilder';
import { generateStepDefsFromMatrixScenarios } from './utils/test-gen/stepDefinitionBuilder';
import { OllamaClient } from './utils/ai/ollamaClient';
import { createDefaultLLMProvider } from './utils/ai/factory';
import { ServiceContainer } from './services/ServiceContainer';
import { promptForConfig } from './utils/interactivePrompt';
import { logger } from './utils/logger';

/**
 * Executes the comprehensive healing workflow
 */
async function executeHealingWorkflow(container: ServiceContainer): Promise<void> {
  try {
    logger.info('\n🔧 Starting comprehensive healing workflow...\n');

    const workflow = new HealingWorkflow(container.healingService);
    const report = await workflow.executeWorkflow();

    logger.info(report.summary);
    logger.info(`\n⏱️ Workflow completed in ${report.duration}ms\n`);

    if (report.steps.length > 0) {
      logger.info('📋 Workflow Steps:');
      for (const step of report.steps) {
        const icon = step.status === 'success' ? '✅' : step.status === 'failed' ? '❌' : '⏳';
        logger.info(`  ${icon} ${step.name}`);
      }
    }

    logger.info('');
  } catch (error) {
    logger.error('❌ Healing workflow error', error instanceof Error ? error : new Error(String(error)));
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
      logger.error('❌ No page objects found. Please generate tests first.');
      process.exit(1);
    }

    logger.info('\n🔍 Checking for duplicate getters in page objects...\n');

    const reports = DuplicateGetterDetector.analyzePageObjects(pageObjectsDir);

    if (reports.length === 0) {
      logger.error('❌ No page objects found.');
      process.exit(1);
    }

    const formattedReport = DuplicateGetterDetector.generateReport(reports);
    logger.info(formattedReport);

    const reportsWithDuplicates = reports.filter((r) => r.hasDuplicates);

    if (reportsWithDuplicates.length === 0) {
      logger.info('✅ All page objects are clean!\n');
      process.exit(0);
    }

    if (fix) {
      logger.info('🔧 Fixing duplicate getters...\n');

      for (const report of reportsWithDuplicates) {
        const result = DuplicateGetterDetector.fixDuplicates(report.filePath, true);
        logger.info(`  ${result.message}`);
      }

      logger.info('\n✅ Duplicate getter fixes completed!\n');
    } else {
      logger.info(
        '\n💡 To fix these duplicates automatically, run: ts-node src/cli.ts --check-duplicates --fix\n'
      );
    }

    process.exit(0);
  } catch (error) {
      logger.error(
        '❌ Duplicate getter check error',
        error instanceof Error ? error : new Error(String(error))
      );
    process.exit(1);
  }
}

/**
 * Re-runs failed tests from the last test execution
 */
async function rerunFailedTests(
  config: TestGenerationConfig = {},
  testGenerationService?: TestGenerationService
): Promise<void> {
  try {
    const failureReport = TestFailureTracker.getFailureReport();

    if (failureReport.failures.length === 0) {
      logger.info('\n✅ No failed tests found. All tests passed in the last run!');
      process.exit(0);
    }

    logger.info('\n🔄 Re-running failed tests...');
    logger.info(`📊 Failed tests to re-run: ${failureReport.failures.length}`);

    failureReport.failures.forEach((failure, index) => {
      logger.info(`  ${index + 1}. ${failure.featureName} > ${failure.scenario}`);
    });

    const instructionsPath = 'instructions-template.csv';

    if (!existsSync(instructionsPath)) {
      logger.error('\n❌ Instructions file not found. Cannot re-run failed tests.');
      logger.error(
        '   Please run test generation first with: ts-node src/cli.ts --instructions instructions-template.csv'
      );
      process.exit(1);
    }

    logger.info('\n🔄 Re-generating test artifacts from instructions...');
    const service = testGenerationService || new TestGenerationService();
    const { featureFilePath: _featureFilePath } = await service.generateArtifactsFromInstructions(instructionsPath, config);

    logger.info('\n🧪 Re-running failed tests...');

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

    logger.info(`🚀 Test command: npx wdio ${wdioArgs.join(' ')}`);

    try {
      execSync(`npx wdio ${quote(wdioArgs)}`, { stdio: 'inherit' });
      logger.info('\n✅ Failed tests re-run completed successfully!');
      TestFailureTracker.clearFailures();
    } catch (error) {
      logger.error(
        '\n❌ Re-run test execution failed',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  } catch (error) {
    logger.error('\n❌ Failed test re-run error', error instanceof Error ? error : new Error(String(error)));
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
    logger.error('❌ Failed step rerun error', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

function buildFeatureFile(
  scenarios: { tags: string[]; name: string; steps: string[] }[],
  url: string
): string {
  const hostname = new URL(url).hostname
  const lines: string[] = []
  lines.push(`Feature: Flow Matrix Discovery for ${hostname}`)
  lines.push(`  Automatically discovered scenarios via live browser exploration of ${url}`)
  lines.push('')

  for (const scenario of scenarios) {
    if (scenario.tags.length > 0) {
      lines.push(`  ${scenario.tags.map((t) => (t.startsWith('@') ? t : `@${t}`)).join(' ')}`)
    }
    lines.push(`  Scenario: ${scenario.name}`)
    for (const step of scenario.steps) {
      lines.push(`    ${step}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

async function main(): Promise<void> {
  const parsedArgs = parseArgs(process.argv.slice(2));
  const isInteractive = parsedArgs['interactive'] === true;
  const shouldRunTests = parsedArgs['run'] !== false;
  const shouldValidate = parsedArgs['validate'];
  const shouldRerun = parsedArgs['rerun'];
  const shouldRerunSteps = parsedArgs['rerun-steps'];
  const shouldCheckDuplicates = parsedArgs['check-duplicates'];
  const shouldFixDuplicates = parsedArgs['fix'];
  const shouldRunHealing = parsedArgs['healing'];

  // Interactive mode: prompt user for configuration
  if (isInteractive) {
    try {
      const interactiveConfig = await promptForConfig();
      validateEnvironment();

      const aiTimeout = 15000;
      const container = new ServiceContainer({
        llmProvider: createDefaultLLMProvider({ model: interactiveConfig.model, maxRetries: 0, timeout: aiTimeout }),
      });

      logger.info(`\nStarting test generation for: ${interactiveConfig.url}`);

      const { matrix, scenarios, log } = await discoverAndGenerate(interactiveConfig.url, container.llmProvider, {
        maxDepth: interactiveConfig.maxDepth,
        maxStates: interactiveConfig.maxStates,
        maxInteractionsPerState: 5,
        timeoutPerState: 15000,
        totalTimeoutMs: 120000,
        maxRadioDepth: 3,
      });

      logger.info(`Discovery complete: ${matrix.states.size} states, ${matrix.transitions.length} transitions`);
      for (const entry of log) {
        logger.info(`  ${entry}`);
      }

      const featuresDir = path.resolve('src/features');
      mkdirSync(featuresDir, { recursive: true });

      const featureContent = buildFeatureFile(scenarios, interactiveConfig.url);
      const featureFileName = `generated_${new URL(interactiveConfig.url).hostname.replace(/\./g, '_')}.feature`;
      const featureFilePath = path.join(featuresDir, featureFileName);
      writeFileSync(featureFilePath, featureContent, 'utf-8');
      logger.info(`Feature file: ${featureFilePath} (${scenarios.length} scenarios)`);

      logger.info('Generating page objects...');
      const statesArray = Array.from(matrix.states.values());
      await buildPageObjectsFromStates(
        statesArray.map((s) => ({
          id: s.id,
          url: s.url,
          elements: s.elements.map((el) => ({
            selector: el.selector,
            text: el.text,
            name: el.name,
          })),
        }))
      );

      logger.info('Generating step definitions...');
      await generateStepDefsFromMatrixScenarios(scenarios, container.llmProvider, { url: interactiveConfig.url });

      if (interactiveConfig.runTests) {
        await container.testRunnerService.runTests(featureFilePath, 60000);
      } else {
        logger.info('Skipping test execution');
      }

      logger.info('\nTest generation completed successfully!');
    } catch (error) {
      logger.error('Error', error instanceof Error ? error : new Error(String(error)));
      process.exit(1);
    }
    return;
  }

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
      const validator = new SelectorValidationService();
      await validator.validateSelectors();
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
      const healingContainer = new ServiceContainer({
        llmProvider: createDefaultLLMProvider({ model: config.ollamaModel, maxRetries: 0, timeout: 15000 }),
      });
      await executeHealingWorkflow(healingContainer);
      process.exit(0);
    }

    validateEnvironment();

    const url = typeof parsedArgs['url'] === 'string' ? parsedArgs['url'] : undefined;

    if (!url && !parsedArgs['instructions']) {
      const [firstArg] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
      if (!firstArg) {
        logger.info(
          [
            '❌ Usage:',
            '  Mode 1 - URL (auto-discover flow matrix):',
            '    ts-node src/cli.ts <url> [options]',
            '',
            '  Mode 2 - Validate Selectors:',
            '    ts-node src/cli.ts --validate',
            '',
            '  Mode 3 - Re-run Failed Tests:',
            '    ts-node src/cli.ts --rerun [options]',
            '',
            '  Mode 4 - Rerun Failed Steps with Healing:',
            '    ts-node src/cli.ts --rerun-steps',
            '',
            '  Mode 5 - Check Duplicate Getters:',
            '    ts-node src/cli.ts --check-duplicates [--fix]',
            '',
            '  Mode 6 - Run Healing Workflow:',
            '    ts-node src/cli.ts --healing',
            '',
            'Options:',
            '  --model <model>      Ollama model to use (default: llama3)',
            '  --timeout <ms>       Test timeout in milliseconds (default: 60000)',
            '  --no-run             Generate tests without executing them',
            '  --smoke-only         Generate only smoke tests (quick validation)',
            '  --max-depth <n>      Max navigation depth for flow discovery (default: 3)',
            '  --max-states <n>     Max states to discover (default: 20)',
            '  --max-interactions <n> Max interactions explored per state (default: 15)',
            '  --max-timeout <ms>   Total exploration timeout in ms (default: 300000)',
            '  --max-radio-depth <n> How deep to chain cascading radio selections (default: 5)',
            '  --ai-timeout <ms>    Timeout for individual AI calls (default: 15000)',
            '  --validate           Dry-run: Check if all selectors exist in DOM',
            '  --rerun              Re-run failed tests from last execution',
            '  --rerun-steps        Rerun failed steps with artifact regeneration',
            '  --check-duplicates   Check for duplicate getters in page objects',
            '  --fix                Fix duplicate getters (auto-merge selectors)',
            '  --healing            Execute comprehensive healing workflow',
            '',
            'Examples:',
            '  ts-node src/cli.ts https://example.com',
            '  ts-node src/cli.ts https://example.com --max-depth 5',
            '  ts-node src/cli.ts https://www.saucedemo.com --no-run',
            '  ts-node src/cli.ts --validate',
            '  ts-node src/cli.ts --rerun',
          ].join('\n')
        );
        process.exit(1);
      }
      parsedArgs['url'] = firstArg;
    }

    const validatedUrl = url
      ? InputValidator.validateURL(url)
      : InputValidator.validateURL(parsedArgs['url'] as string);

    const aiTimeout =
      typeof parsedArgs['ai-timeout'] === 'string'
        ? parseInt(parsedArgs['ai-timeout'], 10)
        : 15000

    const maxRadioDepth =
      typeof parsedArgs['max-radio-depth'] === 'string'
        ? parseInt(parsedArgs['max-radio-depth'], 10)
        : 3;

    logger.info(
      [
        `🚀 Starting flow-matrix-based test generation`,
        `📌 URL: ${validatedUrl}`,
        `🤖 Model: ${config.ollamaModel || 'llama3'}`,
        `⏱️  AI timeout: ${aiTimeout}ms`,
        `🏃‍♂️ Run tests: ${shouldRunTests ? 'Yes' : 'No'}`,
        `📸 Screenshots: ${config.screenshotOnFailure ? 'On failure' : 'Disabled'}`,
        `🔘 Radio cascade depth: ${maxRadioDepth}`,
      ].join('\n')
    );

    const container = new ServiceContainer({
      llmProvider: createDefaultLLMProvider({
        model: config.ollamaModel,
        maxRetries: 0,
        timeout: aiTimeout,
      }),
    });

    logger.info('\n🔍 Discovering flow matrix...');
    const maxDepth = typeof parsedArgs['max-depth'] === 'string' ? parseInt(parsedArgs['max-depth'], 10) : 5;
    const maxStates = typeof parsedArgs['max-states'] === 'string' ? parseInt(parsedArgs['max-states'], 10) : 50;
    const maxInteractions = typeof parsedArgs['max-interactions'] === 'string' ? parseInt(parsedArgs['max-interactions'], 10) : 15;
    const maxTimeout = typeof parsedArgs['max-timeout'] === 'string' ? parseInt(parsedArgs['max-timeout'], 10) : 300000;

    // Create browser context for combinatorial discovery
    let browserCtx: import('./utils/flow-matrix/interactionEngine').BrowserContext | undefined;
    try {
      const { remote } = await import('webdriverio');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const browser: any = await remote({
        capabilities: {
          browserName: process.env.BROWSER || 'chrome',
          'wdio:enforceWebDriverClassic': true,
        },
        logLevel: 'warn' as const,
      });
      browserCtx = {
        url: async (u: string) => browser.url(u),
        execute: async (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => browser.execute(fn, ...args),
        $: async (selector: string) => browser.$(selector),
        keys: async (keys: string | string[]) => browser.keys(keys),
        getUrl: async () => browser.getUrl(),
        getTitle: async () => browser.getTitle(),
        waitUntil: async (condition: () => Promise<boolean>, opts?: { timeout?: number; timeoutMsg?: string }) => browser.waitUntil(condition, opts),
        pause: async (ms: number) => browser.pause(ms),
        closeSession: async () => browser.deleteSession(),
        $$: async (selector: string) => browser.$$(selector),
      };
    } catch {
      logger.warn('Could not create browser context for combinatorial discovery, using BFS fallback');
    }

    const { matrix, scenarios, log } = await discoverAndGenerate(validatedUrl, container.llmProvider, {
      maxDepth,
      maxStates,
      maxInteractionsPerState: maxInteractions,
      timeoutPerState: 15000,
      totalTimeoutMs: maxTimeout,
      maxRadioDepth,
      smokeOnly: parsedArgs['smoke-only'] === true,
    }, browserCtx);

    // Clean up browser context
    if (browserCtx) {
      try { await browserCtx.closeSession(); } catch { /* ignore */ }
    }

    logger.info(`\n📊 Discovery complete: ${matrix.states.size} states, ${matrix.transitions.length} transitions`);
    for (const entry of log) {
      logger.info(`  ${entry}`);
    }

    // Generate feature file
    const featuresDir = path.resolve('src/features');
    mkdirSync(featuresDir, { recursive: true });

    const featureContent = buildFeatureFile(scenarios, validatedUrl);
    const featureFileName = `generated_${new URL(validatedUrl).hostname.replace(/\./g, '_')}.feature`;
    const featureFilePath = path.join(featuresDir, featureFileName);
    writeFileSync(featureFilePath, featureContent, 'utf-8');
    logger.info(`\n📝 Feature file: ${featureFilePath} (${scenarios.length} scenarios)`);

    // Generate page objects from discovered states
    logger.info('\n🏗️ Generating page objects...');
    const statesArray = Array.from(matrix.states.values());
    await buildPageObjectsFromStates(
      statesArray.map((s) => ({
        id: s.id,
        url: s.url,
        elements: s.elements.map((el) => ({
          selector: el.selector,
          text: el.text,
          name: el.name,
        })),
      }))
    );

    // Generate step definitions
    logger.info('\n⚙️ Generating step definitions...');
    await generateStepDefsFromMatrixScenarios(scenarios, container.llmProvider, { url: validatedUrl });

    // Run tests if requested
    if (shouldRunTests) {
      await container.testRunnerService.runTests(featureFilePath, config.testTimeout);
    } else {
      logger.info('\n⏭️ Skipping test execution (--no-run flag set)');
    }

    logger.info('\n🎉 Test generation completed successfully!');
  } catch (error) {
    logger.error('\n❌ Error', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error('Unhandled error', error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});
