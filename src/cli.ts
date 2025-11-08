#!/usr/bin/env ts-node
// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

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
      throw new Error('WebdriverIO not found. Please install with: npm install --save-dev @wdio/cli');
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
    timeout: config.testTimeout
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
      '--specFileRetries 1'
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

async function main() {
  const parsedArgs = parseArgs(process.argv.slice(2));
  const shouldRunTests = !parsedArgs['no-run'];
  
  const config: TestGenerationConfig = {
    ollamaModel: typeof parsedArgs['model'] === 'string' ? parsedArgs['model'] : undefined,
    testTimeout: typeof parsedArgs['timeout'] === 'string' ? parseInt(parsedArgs['timeout']) : TIMEOUTS.DEFAULT_TEST_TIMEOUT,
    screenshotOnFailure: !parsedArgs['no-screenshots']
  };

  try {
    validateEnvironment();

    // Check if using instructions file
    if (parsedArgs['instructions']) {
      const instructionsPath = typeof parsedArgs['instructions'] === 'string' 
        ? parsedArgs['instructions'] 
        : 'instructions.json';

      console.log([
        `🚀 Starting AI-powered test generation from instructions`,
        `📄 Instructions file: ${instructionsPath}`,
        `🤖 Model: ${config.ollamaModel || 'llama3'}`,
        `⏱️ Timeout: ${config.testTimeout}ms`,
        `🏃‍♂️ Run tests: ${shouldRunTests ? 'Yes' : 'No'}`,
        `📸 Screenshots: ${config.screenshotOnFailure ? 'On failure' : 'Disabled'}`
      ].join('\n'));

      const { featureFilePath } = await generateArtifactsFromInstructions(
        instructionsPath,
        config
      );

      if (shouldRunTests) {
        runTests(featureFilePath, config.testTimeout);
      } else {
        console.log('\n⏭️ Skipping test execution (--no-run flag set)');
      }
    } else {
      // Original URL + instruction mode
      const [url, ...instructionParts] = process.argv.slice(2).filter(arg => !arg.startsWith('--'));

      if (!url || instructionParts.length === 0) {
        console.error([
          '❌ Usage:',
          '  Mode 1 - URL + Instruction:',
          '    ts-node src/cli.ts <url> "<test instruction>" [options]',
          '',
          '  Mode 2 - Instructions file:',
          '    ts-node src/cli.ts --instructions [<path>] [options]',
          '',
          'Options:',
          '  --model <model>      Ollama model to use (default: llama3)',
          '  --timeout <ms>       Test timeout in milliseconds (default: 60000)',
          '  --no-run             Generate tests without executing them',
          '',
          'Examples:',
          '  ts-node src/cli.ts https://example.com "Test login" --model llama3',
          '  ts-node src/cli.ts --instructions instructions.json --no-run',
          '  ts-node src/cli.ts --instructions ./custom-instructions.json'
        ].join('\n'));
        process.exit(1);
      }

      // Validate URL
      if (!isValidUrl(url)) {
        console.error(`❌ Invalid URL: ${url}. Only http:// and https:// URLs are allowed.`);
        process.exit(1);
      }

      const instruction = instructionParts.join(' ');

      console.log([
        `🚀 Starting AI-powered test generation`,
        `📌 URL: ${url}`,
        `📝 Instruction: ${instruction}`,
        `🤖 Model: ${config.ollamaModel || 'llama3'}`,
        `⏱️ Timeout: ${config.testTimeout}ms`,
        `🏃‍♂️ Run tests: ${shouldRunTests ? 'Yes' : 'No'}`,
        `📸 Screenshots: ${config.screenshotOnFailure ? 'On failure' : 'Disabled'}`
      ].join('\n'));

      const { featureFilePath } = await generateTestArtifacts(
        url,
        instruction,
        config
      );

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