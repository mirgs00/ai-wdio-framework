#!/usr/bin/env ts-node
// Load environment variables from .env file
let dotenv: any;
try {
  dotenv = require('dotenv');
  dotenv.config();
} catch {
  console.warn('Warning: dotenv not fully loaded, continuing without .env support');
}

import { buildPageObjects } from './utils/test-gen/pageObjectBuilder';
import { buildScenario } from './utils/test-gen/scenarioBuilder';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import * as path from 'path';
import { fetchDOM } from './utils/dom/domParser';
import { createOllamaClient } from './utils/ai/ollamaClient';
import { TIMEOUTS } from './utils/constants';
import { InstructionParser } from './utils/test-gen/instructionParser';
import { logger } from './utils/logger';
import {
  validateAllPageSelectors,
  generateValidationReport,
  exportValidationResults,
} from './utils/healing/selectorValidator';
import { TestFailureTracker } from './utils/test-gen/testFailureTracker';
import { DuplicateGetterDetector } from './utils/test-gen/duplicateGetterDetector';
import { HealingWorkflow } from './utils/healing/healingWorkflow';
import { rerunFailedStepsService } from './utils/test-gen/rerunFailedSteps';
import { InputValidator } from './utils/validation';

interface TestGenerationConfig {
  ollamaModel?: string;
  ollamaBaseUrl?: string;
  testTimeout?: number;
  screenshotOnFailure?: boolean;
}

function validateEnvironment(): void {
  console.log('🔍 Validating environment...');

  try {
    execSync('npx wdio --version', { stdio: 'ignore' });
    console.log('✅ WebdriverIO found (local)');
  } catch {
    try {
      execSync('wdio --version', { stdio: 'ignore' });
      console.log('✅ WebdriverIO found (global)');
    } catch {
      throw new Error(
        'WebdriverIO not found. Please install with: npm install --save-dev @wdio/cli'
      );
    }
  }

  try {
    execSync('npx ts-node --version', { stdio: 'ignore' });
    console.log('✅ ts-node found (local)');
  } catch {
    try {
      execSync('ts-node --version', { stdio: 'ignore' });
      console.log('✅ ts-node found (global)');
    } catch {
      throw new Error('ts-node not found. Please install with: npm install --save-dev ts-node');
    }
  }

  if (!existsSync('./wdio.conf.ts')) {
    throw new Error('WebdriverIO config (wdio.conf.ts) not found in project root.');
  }

  console.log('✅ Environment validation passed');
}

async function generateTestArtifacts(
  url: string,
  instruction: string,
  config: TestGenerationConfig = {}
): Promise<{
  featureFilePath: string;
  pageObjectPath: string;
  stepDefinitionsPath: string;
}> {
  const ollamaClient = createOllamaClient({
    baseUrl: config.ollamaBaseUrl,
    model: config.ollamaModel,
    timeout: config.testTimeout,
  });

  // Check Ollama availability upfront
  console.log('\n🔍 Checking Ollama service availability...');
  const ollamaAvailable = await ollamaClient.checkHealth();
  if (!ollamaAvailable) {
    console.warn('\n⚠️  ═════════════════════════════════════════════════════════════════');
    console.warn('⚠️  NOTICE: Ollama service is not running');
    console.warn('⚠️  ═════════════════════════════════════════════════════════════════');
    console.warn('⚠️  Generation will proceed with BASIC step templates');
    console.warn('⚠️  AI-powered optimization is temporarily disabled');
    console.warn('⚠️  ');
    console.warn('⚠️  To enable AI features later, run in another terminal:');
    console.warn('⚠️    npm run ollama:start');
    console.warn('⚠️  ═════════════════════════════════════════════════════════════════\n');
  } else {
    console.log('✅ Ollama service is ready - AI-powered generation enabled!\n');
  }

  console.log('\n🌐 Fetching DOM from:', url);
  const domContent = await fetchDOM(url);

  console.log('\n🏗️ Building page object...');
  await buildPageObjects(url, domContent);
  const pageObjectPath = path.resolve('src/page-objects/generatedPage.ts');

  console.log('\n🎯 Generating scenarios and step definitions...');
  const featureFilePath = await buildScenario(url, instruction);

  const stepDefinitionsPath = path.resolve('src/step-definitions/generatedSteps.ts');

  return { featureFilePath, pageObjectPath, stepDefinitionsPath };
}

function runTests(featureFilePath: string, timeout: number = TIMEOUTS.DEFAULT_TEST_TIMEOUT): void {
  try {
    console.log('\n🧪 Running generated tests...');
    const absFeaturePath = path.resolve(featureFilePath);

    const wdioCommand = [
      'npx wdio run ./wdio.conf.ts',
      `--spec ${absFeaturePath}`,
      `--mochaOpts.timeout ${timeout}`,
      '--specFileRetries 1',
    ].join(' ');

    console.log(`🚀 Test command: ${wdioCommand}`);
    execSync(wdioCommand, { stdio: 'inherit' });
    console.log('✅ Tests completed successfully!');
  } catch (error) {
    console.error('❌ Test execution failed:', error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Validates all generated selectors by checking if they exist in the DOM
 * This is a dry-run check before actual test execution
 */
async function validateSelectors(): Promise<void> {
  try {
    console.log('\n🔍 Starting selector validation...');

    const pageObjectsDir = path.resolve('src/page-objects');
    if (!existsSync(pageObjectsDir)) {
      console.error('❌ No page objects found. Please generate tests first.');
      process.exit(1);
    }

    // Extract page URLs and selectors from generated page objects
    const pages: Record<string, { selectors: Record<string, string>; url?: string }> = {};

    const files = require('fs')
      .readdirSync(pageObjectsDir)
      .filter((f: string) => f.startsWith('generated') && f.endsWith('.ts'));

    for (const file of files) {
      const filePath = path.join(pageObjectsDir, file);
      const content = readFileSync(filePath, 'utf-8');

      // Extract page name
      const pageNameMatch = file.match(/generated(\w+)Page\.ts/);
      const pageName = pageNameMatch ? pageNameMatch[1].toLowerCase() : file.replace(/\.ts$/, '');

      // Extract URL from JSDoc comment or getter
      const urlMatch = content.match(/Page URL:\s*(\S+)/);
      const url = urlMatch ? urlMatch[1] : undefined;

      // Extract all getter methods and their selectors
      const getterRegex = /get\s+(\w+)\s*\(\s*\)\s*{\s*return\s+\$\(['"`]([^'"`]+)['"`]\)/g;
      const selectors: Record<string, string> = {};

      let match;
      while ((match = getterRegex.exec(content)) !== null) {
        const getterName = match[1];
        const selectorText = match[2];
        selectors[getterName] = selectorText;
      }

      if (Object.keys(selectors).length > 0) {
        pages[pageName] = { selectors, url };
      }
    }

    if (Object.keys(pages).length === 0) {
      console.error('❌ No selectors found in page objects.');
      process.exit(1);
    }

    console.log(`\n📋 Found ${Object.keys(pages).length} page object(s) with selectors`);

    // Open browser and validate selectors
    const { remote } = await import('webdriverio');
    const browser = await remote({
      capabilities: { browserName: 'chrome' },
    });

    try {
      const results = [];

      for (const [pageName, pageData] of Object.entries(pages)) {
        if (pageData.url) {
          console.log(`\n🌐 Opening ${pageName} page: ${pageData.url}`);
          await browser.url(pageData.url);

          // Wait for page to load
          await browser.waitUntil(
            async () => (await browser.execute(() => document.readyState)) === 'complete',
            { timeout: 10000 }
          );
        }

        const result = await validateAllPageSelectors({ [pageName]: pageData });
        results.push(...result);
      }

      // Print report
      const report = generateValidationReport(results);
      console.log(report);

      // Export results
      const resultsFile = path.resolve('selector-validation-results.json');
      exportValidationResults(results, resultsFile);

      // Exit with appropriate code
      const hasErrors = results.some((r) => r.invalidSelectors > 0);
      if (hasErrors) {
        console.error('\n❌ Selector validation failed. Some selectors are broken.');
        process.exit(1);
      } else {
        console.log('\n✅ All selectors are valid!');
      }
    } finally {
      await browser.deleteSession();
    }
  } catch (error) {
    console.error('❌ Selector validation error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Validates if a string is a valid URL
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Parses command line arguments into a key-value object
 */
function parseArgs(args: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);

      if (key.startsWith('no-')) {
        parsed[key.slice(3)] = false;
      } else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        parsed[key] = args[++i];
      } else {
        parsed[key] = true;
      }
    }
  }

  return parsed;
}

/**
 * Generate artifacts from instructions file
 */
async function generateArtifactsFromInstructions(
  instructionsPath: string,
  config: TestGenerationConfig = {}
): Promise<{
  featureFilePath: string;
  pageObjectPath: string;
  stepDefinitionsPath: string;
}> {
  if (!existsSync(instructionsPath)) {
    throw new Error(`Instructions file not found: ${instructionsPath}`);
  }

  console.log('\n📖 Loading instructions from:', instructionsPath);
  const instructions = JSON.parse(readFileSync(instructionsPath, 'utf-8'));

  // Extract URL from instructions
  const url = instructions.url;
  if (!url || !isValidUrl(url)) {
    throw new Error(`Invalid or missing URL in instructions file. URL must be http(s):// format`);
  }

  console.log(`✅ Project: ${instructions.projectName}`);
  console.log(`✅ URL: ${url}`);
  console.log(`✅ Description: ${instructions.description}`);
  console.log(`✅ Test cases: ${instructions.testCases.length}`);

  // Generate artifacts from instructions
  console.log('\n🔄 Generating artifacts from instructions...');
  const parser = new InstructionParser();
  const artifacts = parser.generateFromInstructions(instructions);

  // Save primary page object (for backward compatibility)
  const pageObjectPath = path.resolve('src/page-objects/generatedPage.ts');
  writeFileSync(pageObjectPath, artifacts.pageObject);
  console.log(`✅ Page Object saved: ${pageObjectPath}`);

  // Save multiple page objects if generated (multi-page support)
  if (artifacts.pageObjects) {
    Object.entries(artifacts.pageObjects).forEach(([pageName, pageObjectCode]) => {
      const fileName = `generated${pageName.charAt(0).toUpperCase() + pageName.slice(1)}Page.ts`;
      const pageObjectMultiPath = path.resolve('src/page-objects', fileName);
      writeFileSync(pageObjectMultiPath, pageObjectCode);
      console.log(`✅ Multi-page Object (${pageName}) saved: ${pageObjectMultiPath}`);
    });
  }

  // Save page context manager if generated (multi-page support)
  if (artifacts.pageContextManager) {
    const pageContextManagerPath = path.resolve('src/page-objects/pageContextManager.ts');
    writeFileSync(pageContextManagerPath, artifacts.pageContextManager);
    console.log(`✅ Page Context Manager saved: ${pageContextManagerPath}`);
  }

  // Save feature file
  const featureFileName = `${instructions.projectName.toLowerCase().replace(/\s+/g, '_')}.feature`;
  const featureFilePath = path.resolve('src/features', featureFileName);
  writeFileSync(featureFilePath, artifacts.featureFile);
  console.log(`✅ Feature File saved: ${featureFilePath}`);

  // Save step definitions
  const stepDefinitionsPath = path.resolve('src/step-definitions/generatedSteps.ts');
  writeFileSync(stepDefinitionsPath, artifacts.stepDefinitions);
  console.log(`✅ Step Definitions saved: ${stepDefinitionsPath}`);

  return { featureFilePath, pageObjectPath, stepDefinitionsPath };
}

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
    const { featureFilePath } = await generateArtifactsFromInstructions(instructionsPath, config);

    console.log('\n🧪 Re-running failed tests...');

    const failedFeatures = failureReport.failures
      .map((f) => `src/features/${f.featureName.toLowerCase().replace(/\s+/g, '_')}.feature`)
      .filter((f, index, arr) => arr.indexOf(f) === index);

    const wdioCommand = [
      'npx wdio run ./wdio.conf.ts',
      failedFeatures.map((f) => `--spec ${path.resolve(f)}`).join(' '),
      `--mochaOpts.timeout ${config.testTimeout || TIMEOUTS.DEFAULT_TEST_TIMEOUT}`,
      '--specFileRetries 1',
    ].join(' ');

    console.log(`🚀 Test command: ${wdioCommand}`);

    try {
      execSync(wdioCommand, { stdio: 'inherit' });
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
      await validateSelectors();
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

      const { featureFilePath } = await generateArtifactsFromInstructions(instructionsPath, config);

      if (shouldRunTests) {
        runTests(featureFilePath, config.testTimeout);
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

      const { featureFilePath } = await generateTestArtifacts(validatedUrl, instruction, config);

      if (shouldRunTests) {
        runTests(featureFilePath, config.testTimeout);
      } else {
        console.log('\n⏭️ Skipping test execution (--no-run flag set)');
      }
    }

    console.log('\n🎉 Test generation completed successfully!');
  } catch (error) {
    console.error('\n❌ Test generation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().catch(console.error);
