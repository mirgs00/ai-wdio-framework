// src/utils/test-gen/scenarioBuilder.ts
try {
  require('dotenv/config');
} catch {
  // dotenv may not be available
}
import { getDOMSnapshot } from '../dom/domParser';
import { OllamaClient } from '../ai/ollamaClient';
import { analyzeDOM } from '../dom/domAnalyzer';
import { promptTemplateManager } from '../ai/promptTemplates';
import { scenarioClassifier } from './scenarioClassifier';
import { ScenarioQualityValidator } from './qualityValidator';
import { buildStepDefinitions, generateStepDefinitions, DEFAULT_PARAMETERS } from './stepDefinitionBuilder';
import fs from 'fs';
import path from 'path';
import { load } from 'cheerio';

const scenarioQualityValidator = new ScenarioQualityValidator();

/**
 * Builds a complete test scenario based on a URL and user instruction.
 * Fetches the page, analyzes its structure, generates feature files and step definitions.
 *
 * @param url - The URL of the web page to test
 * @param instruction - The test instruction describing what scenarios to generate
 * @returns Promise resolving to the generated feature file path
 * @throws Error if URL is invalid or scenario generation fails
 */
export async function buildScenario(url: string, instruction: string): Promise<string> {
  console.log(`🌐 Fetching DOM snapshot from: ${url}`);
  const dom = await getDOMSnapshot(url);

  console.log('🔍 Analyzing DOM structure...');
  const pageAnalysis = analyzeDOM(dom);

  console.log(`📊 Page Analysis:`);
  console.log(`   - Title: ${pageAnalysis.title}`);
  console.log(`   - Main Functionality: ${pageAnalysis.mainFunctionality}`);
  console.log(`   - Forms: ${pageAnalysis.forms.length}`);
  console.log(`   - Input Fields: ${pageAnalysis.inputFields.length}`);
  console.log(`   - Buttons: ${pageAnalysis.buttons.length}`);

  const complexity = scenarioClassifier.assessPageComplexity(
    pageAnalysis.forms.length,
    pageAnalysis.inputFields.length,
    pageAnalysis.buttons.length
  );

  console.log(`📈 Page Complexity: ${complexity}`);

  console.log('🎯 Generating scenario prompts based on page structure...');
  const ollamaClient = new OllamaClient();

  const scenarioTypes = ['happy-path', 'negative', 'validation'] as const;
  const scenarioPrompts = new Map<string, string>();

  for (const type of scenarioTypes) {
    const template = promptTemplateManager.getTemplate(type);
    const prompt = template.generatePrompt(pageAnalysis, instruction);
    scenarioPrompts.set(type, prompt);
  }

  console.log('🧠 Generating scenarios with AI...');
  let allScenarios = '';

  for (const [type, prompt] of scenarioPrompts) {
    try {
      console.log(`   Generating ${type} scenarios...`);
      const scenarios = await ollamaClient.generateText(prompt, {
        temperature: 0.3,
        max_tokens: 800,
      });
      allScenarios += `\n\n${scenarios}`;
    } catch (error) {
      console.warn(
        `   ⚠️ Failed to generate ${type} scenarios: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  let featureContentRaw = allScenarios.trim();

  if (!featureContentRaw || featureContentRaw.length < 50) {
    console.warn('⚠️ AI generation produced minimal output, using fallback feature');
    featureContentRaw = createEnhancedFallbackFeature(pageAnalysis, instruction);
  }

  const featureContent = buildFeatureHeader(pageAnalysis, instruction) + featureContentRaw;

  const featuresDir = path.resolve('src/features');
  if (!fs.existsSync(featuresDir)) {
    fs.mkdirSync(featuresDir, { recursive: true });
  }

  const fileName = generateFileName(url);
  const fullPath = path.join(featuresDir, fileName);

  const sanitizedFeatureContent = sanitizeGherkinContent(featureContent);

  fs.writeFileSync(fullPath, sanitizedFeatureContent, 'utf-8');

  console.log(`✅ Feature file generated at: ${fullPath}`);

  const validation = scenarioQualityValidator.validateScenarioContent(sanitizedFeatureContent);
  console.log(`📝 Feature Quality Score: ${validation.score}/100`);
  console.log(`📝 Feature summary:
  - Scenarios: ${(sanitizedFeatureContent.match(/Scenario:/g) || []).length}
  - Steps: ${(sanitizedFeatureContent.match(/(Given|When|Then|And|But)/g) || []).length}`);

  if (validation.warnings.length > 0) {
    console.log('⚠️ Warnings:');
    validation.warnings.forEach((w) => console.log(`   - ${w}`));
  }

  if (validation.suggestions.length > 0) {
    console.log('💡 Suggestions:');
    validation.suggestions.slice(0, 2).forEach((s) => console.log(`   - ${s}`));
  }

  console.log('\n📋 Generating step definitions...');
  try {
    // Parse the feature content to extract scenarios and steps
    const scenarios = parseFeatureContent(sanitizedFeatureContent);
    
    // Generate step definitions from the parsed scenarios
    const stepDefs = await generateStepDefinitions(scenarios, ollamaClient, {
      url,
      applicationContext: featureContentRaw
    });
    
    // Build the step definitions file
    await buildStepDefinitions(stepDefs);
  } catch (error) {
    console.warn(
      `⚠️ Failed to generate step definitions: ${error instanceof Error ? error.message : error}`
    );
  }

  return fullPath;
}

function buildFeatureHeader(pageAnalysis: any, instruction: string): string {
  const title = pageAnalysis.title || 'Feature Test';
  const description = instruction || pageAnalysis.description;

  return `Feature: ${title} Testing
  As a user
  I want to test ${description}
  So that I can verify the functionality works correctly

`;
}

function sanitizeGherkinContent(content: string): string {
  const lines = content.split('\n');
  const sanitizedLines: string[] = [];

  for (const line of lines) {
    if (/^\s*(Feature:|Scenario:|Background:|Given |When |Then |And |But |@|#)/.test(line)) {
      sanitizedLines.push(line);
    } else if (line.trim() === '') {
      sanitizedLines.push(line);
    }
  }

  return (
    sanitizedLines
      .join('\n')
      .replace(/\n\n\n+/g, '\n\n')
      .trim() + '\n'
  );
}

function generateFileName(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    const lastPathPart =
      pathParts.length > 0
        ? pathParts[pathParts.length - 1].replace(/\.[^/.]+$/, '') // Remove extension
        : 'home';

    const hostnamePart = urlObj.hostname.replace('www.', '').split('.')[0];
    const safeName = `${hostnamePart}_${lastPathPart}`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

    return `${safeName}.feature`;
  } catch {
    return `generated_${Date.now()}.feature`;
  }
}

function createEnhancedFallbackFeature(pageAnalysis: any, instruction: string): string {
  // Use environment variables or defaults
  const validUsername = process.env.USERNAME || 'student';
  const validPassword = process.env.PASSWORD || 'Password123';
  
  let scenarios = '';

  if (pageAnalysis.forms.length > 0 && pageAnalysis.inputFields.length > 0) {
    scenarios += `
  @smoke @positive
  Scenario: Successful Login with Valid Credentials
    Given I am on the login page
    When I enter valid username "${validUsername}" and password "${validPassword}"
    And I click the "submit" button
    Then I should see a successful login message "Logged In Successfully"

  @negative @validation
  Scenario: Invalid username format
    Given I am on the login page
    When I enter "invalid_username" as my username and any password
    And I click the "submit" button
    Then the error message "Your username is invalid!" should be displayed
    And the form remains on the login page
`;
  }

  return scenarios;
}

function parseFeatureContent(featureContent: string): any[] {
  const scenarios: any[] = [];
  const lines = featureContent.split('\n');
  let currentScenario: any = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('Scenario:')) {
      if (currentScenario) {
        scenarios.push(currentScenario);
      }
      currentScenario = {
        name: trimmed.replace('Scenario:', '').trim(),
        steps: []
      };
    } else if (trimmed.match(/^\s*(Given|When|Then|And|But)\s/)) {
      if (currentScenario) {
        const stepMatch = trimmed.match(/^\s*(Given|When|Then|And|But)\s(.+)$/);
        if (stepMatch) {
          const stepType = stepMatch[1] === 'And' || stepMatch[1] === 'But' ? 'Given' : stepMatch[1];
          currentScenario.steps.push({
            type: stepType as 'Given' | 'When' | 'Then',
            text: stepMatch[2]
          });
        }
      }
    }
  }
  
  if (currentScenario) {
    scenarios.push(currentScenario);
  }
  
  return scenarios;
}
