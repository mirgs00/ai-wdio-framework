import { buildPageObjects } from '../utils/test-gen/pageObjectBuilder';
import { buildScenario } from '../utils/test-gen/scenarioBuilder';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import * as path from 'path';
import { fetchDOM } from '../utils/dom/domParser';
import { createOllamaClient } from '../utils/ai/ollamaClient';
import { InstructionParser } from '../utils/test-gen/instructionParser';
import { TestGenerationConfig } from '../types';
import { InputValidator } from '../utils/validation';

export class TestGenerationService {
  async generateTestArtifacts(
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

  async generateArtifactsFromInstructions(
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
    // Use InputValidator if possible, but here we just need to validate
    try {
        InputValidator.validateURL(url);
    } catch (error) {
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
        writeFileSync(pageObjectMultiPath, pageObjectCode as string);
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
}
