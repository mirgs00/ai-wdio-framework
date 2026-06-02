import { buildPageObjects } from '../utils/test-gen/pageObjectBuilder';
import { buildScenario } from '../utils/test-gen/scenarioBuilder';
import { buildStepDefinitions } from '../utils/test-gen/stepDefinitionBuilder';
import { existsSync, writeFileSync } from 'fs';
import * as path from 'path';
import { fetchDOM } from '../utils/dom/domParser';
import { createOllamaClient, OllamaClient } from '../utils/ai/ollamaClient';
import { parseInstructionFile } from '../utils/file-parser';
import { TestGenerationConfig } from '../types';
import { InputValidator } from '../utils/validation';
import type { LLMProvider } from '../utils/ai/types';

export interface TestGenerationServiceOptions {
  llmProvider?: LLMProvider;
}

export class TestGenerationService {
  private llmProvider: LLMProvider | null;

  constructor(options: TestGenerationServiceOptions = {}) {
    this.llmProvider = options.llmProvider || null;
  }

  /**
   * Generate steps from a plain instruction string.
   * This is a lightweight fallback used by tests and when AI is unavailable.
   */
  async generateSteps(instruction: string): Promise<{ steps: Array<{ type: 'Given' | 'When' | 'Then' | 'And' | 'But' ; text: string }> }> {
    if (!instruction || instruction.trim().length === 0) {
      return { steps: [] };
    }

    const rawParts = instruction
      .split(/(?:[.?!]\s+)|\s+and\s+|;|\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    const steps = rawParts.map((part) => {
      const lower = part.toLowerCase();
      let type: 'Given' | 'When' | 'Then' | 'And' | 'But' = 'When';

      if (lower.includes('navigate') || lower.includes('open') || lower.includes('visit')) type = 'Given';
      else if (lower.includes('should') || lower.includes('verify') || lower.includes('expect') || lower.includes('see') || lower.includes('assert')) type = 'Then';
      else if (lower.includes('click') || lower.includes('submit') || lower.includes('fill') || lower.includes('enter') || lower.includes('type')) type = 'When';

      const text = part.replace(/\s+/g, ' ').trim();
      return { type, text };
    });

    return { steps };
  }

  private getLLMClient(config: TestGenerationConfig = {}): LLMProvider {
    if (this.llmProvider) {
      return this.llmProvider;
    }
    return createOllamaClient({
      baseUrl: config.ollamaBaseUrl,
      model: config.ollamaModel,
      timeout: config.testTimeout,
    });
  }

  async generateTestArtifacts(
    url: string,
    instruction: string,
    config: TestGenerationConfig = {}
  ): Promise<{
    featureFilePath: string;
    pageObjectPath: string;
    stepDefinitionsPath: string;
  }> {
    const ollamaClient = this.getLLMClient(config);

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

  async generateArtifactsFromInstructions(
    instructionsPath: string,
    _config: TestGenerationConfig = {}
  ): Promise<{
    featureFilePath: string;
    pageObjectPath: string;
    stepDefinitionsPath: string;
  }> {
    if (!existsSync(instructionsPath)) {
      throw new Error(`Instructions file not found: ${instructionsPath}`);
    }

    console.log('\n📖 Loading instructions from:', instructionsPath);
    const instructions = await parseInstructionFile(instructionsPath);

    const url = instructions.url;
    try {
        InputValidator.validateURL(url);
    } catch (error) {
         throw new Error(`Invalid or missing URL in instructions file. URL must be http(s):// format`);
    }

    console.log(`✅ Project: ${instructions.projectName}`);
    console.log(`✅ URL: ${url}`);
    console.log(`✅ Description: ${instructions.description}`);
    console.log(`✅ Test cases: ${instructions.testCases.length}`);

    // 1. Fetch the real DOM from the URL
    console.log('\n🌐 Fetching DOM from URL for real page analysis...');
    const domContent = await fetchDOM(url);

    // 2. Build page objects from the actual DOM (not keyword guesses)
    console.log('\n🏗️ Building page objects from real DOM...');
    await buildPageObjects(url, domContent);
    const pageObjectPath = path.resolve('src/page-objects/generatedPage.ts');
    console.log(`✅ Page Object saved: ${pageObjectPath}`);

    // 3. Generate the feature file from the instructions' test cases
    console.log('\n📝 Generating feature file from instructions...');
    const featureContent = generateFeatureFromInstructions(instructions);
    const featureFileName = `${instructions.projectName.toLowerCase().replace(/\s+/g, '_')}.feature`;
    const featureFilePath = path.resolve('src/features', featureFileName);
    writeFileSync(featureFilePath, featureContent);
    console.log(`✅ Feature File saved: ${featureFilePath}`);

    // 4. Generate step definitions from the real DOM and page objects
    console.log('\n📋 Generating step definitions with real selectors...');
    const stepDefinitionsPath = path.resolve('src/step-definitions/generatedSteps.ts');
    await buildStepDefinitions(featureContent, url, domContent);
    console.log(`✅ Step Definitions saved: ${stepDefinitionsPath}`);

    return { featureFilePath, pageObjectPath, stepDefinitionsPath };
  }
}

function determineStepType(step: string): 'Given' | 'When' | 'Then' | 'And' {
  const lowerStep = step.toLowerCase();

  if (lowerStep.includes('navigate') || lowerStep.includes('open') || lowerStep.includes('visit') || lowerStep.includes('on the page') || lowerStep.includes('on the login')) {
    return 'Given';
  }

  if (lowerStep.includes('should') || lowerStep.includes('verify') || lowerStep.includes('expect') || lowerStep.includes('see') || lowerStep.includes('remain') || lowerStep.includes('error message')) {
    return 'Then';
  }

  if (lowerStep.includes('remain') || lowerStep.includes('form')) {
    return 'And';
  }

  return 'When';
}

function generateFeatureFromInstructions(instructions: import('../utils/test-gen/instructionParser').Instructions): string {
  let feature = `Feature: ${instructions.projectName}
  ${instructions.description}

`;

  for (const testCase of instructions.testCases) {
    if (testCase.tags.length > 0) {
      feature += `  ${testCase.tags.map((t) => `@${t}`).join(' ')}\n`;
    }
    feature += `  Scenario: ${testCase.name}
`;
    let previousType: 'Given' | 'When' | 'Then' | 'And' | null = null;
    for (const step of testCase.steps) {
      const type = determineStepType(step);
      const keyword = previousType && type === previousType ? 'And' : type;
      feature += `    ${keyword} ${step}\n`;
      previousType = type;
    }
    feature += '\n';
  }

  return feature;
}
