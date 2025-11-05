#!/usr/bin/env ts-node
// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

import { buildPageObjects } from './utils/test-gen/pageObjectBuilder';
import { buildScenario } from './utils/test-gen/scenarioBuilder';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import * as path from 'path';
import { fetchDOM } from './utils/dom/domParser';
import { createOllamaClient } from './utils/ai/ollamaClient';
import { TIMEOUTS } from './utils/constants';

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
  createOllamaClient({
    baseUrl: config.ollamaBaseUrl,
    model: config.ollamaModel,
    timeout: config.testTimeout
  });

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

async function main() {
  const [url, ...instructionParts] = process.argv.slice(2);

  if (!url || instructionParts.length === 0) {
    console.error([
      '❌ Usage: ts-node src/cli.ts <url> "<test instruction>"',
      '',
      'Options:',
      '  --model <model>      Ollama model to use (default: llama3)',
      '  --timeout <ms>       Test timeout in milliseconds (default: 60000)',
      '  --no-run             Generate tests without executing them',
      '',
      'Example:',
      '  ts-node src/cli.ts https://example.com "Test login functionality" --model llama3'
    ].join('\n'));
    process.exit(1);
  }

  // Validate URL
  if (!isValidUrl(url)) {
    console.error(`❌ Invalid URL: ${url}. Only http:// and https:// URLs are allowed.`);
    process.exit(1);
  }

  const instruction = instructionParts
    .filter(part => !part.startsWith('--'))
    .join(' ');
  
  const parsedArgs = parseArgs(process.argv.slice(2));
  const config: TestGenerationConfig = {
    ollamaModel: parsedArgs['model'],
    testTimeout: parsedArgs['timeout'] ? parseInt(parsedArgs['timeout']) : DEFAULT_TEST_TIMEOUT,
    screenshotOnFailure: !parsedArgs['no-screenshots']
  };
  const shouldRunTests = !parsedArgs['no-run'];

  console.log([
    `🚀 Starting AI-powered test generation`,
    `📌 URL: ${url}`,
    `📝 Instruction: ${instruction}`,
    `🤖 Model: ${config.ollamaModel || 'llama3'}`,
    `⏱️ Timeout: ${config.testTimeout}ms`,
    `🏃‍♂️ Run tests: ${shouldRunTests ? 'Yes' : 'No'}`,
    `📸 Screenshots: ${config.screenshotOnFailure ? 'On failure' : 'Disabled'}`
  ].join('\n'));

  try {
    validateEnvironment();

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

    console.log('\n🎉 Test generation completed successfully!');
  } catch (error) {
    console.error('\n❌ Test generation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().catch(console.error);