import { mkdirSync, writeFileSync } from 'fs';
import * as path from 'path';
import { discoverAndGenerate } from '../utils/flow-matrix/flowMatrixBuilder';
import { buildPageObjectsFromStates } from '../utils/test-gen/pageObjectBuilder';
import { generateStepDefsFromMatrixScenarios } from '../utils/test-gen/stepDefinitionBuilder';
import { TestGenerationService } from './TestGenerationService';
import type { ServiceContainer } from './ServiceContainer';
import type { LLMProvider } from '../utils/ai/types';
import { logger } from '../utils/logger';

export interface GenerationInput {
  url: string;
  instruction?: string;
  mode: 'flow-matrix' | 'instructions-csv';
  config?: {
    maxDepth?: number;
    maxStates?: number;
    maxRadioDepth?: number;
    timeout?: number;
    instructionsPath?: string;
  };
}

export interface GenerationOutput {
  featureFilePath: string;
  pageObjectPaths: string[];
  stepDefinitionsPath: string;
  scenarioCount: number;
}

export class GenerationPipeline {
  constructor(private container: ServiceContainer) {}

  async generate(input: GenerationInput): Promise<GenerationOutput> {
    if (input.mode === 'flow-matrix') {
      return this.generateFromFlowMatrix(input);
    } else {
      return this.generateFromInstructions(input);
    }
  }

  private async generateFromFlowMatrix(input: GenerationInput): Promise<GenerationOutput> {
    const maxDepth = input.config?.maxDepth ?? 3;
    const maxStates = input.config?.maxStates ?? 20;
    const maxRadioDepth = input.config?.maxRadioDepth ?? 3;

    logger.info(`Starting flow-matrix test generation for: ${input.url}`);

    const { matrix, scenarios } = await discoverAndGenerate(input.url, this.container.llmProvider, {
      maxDepth,
      maxStates,
      maxInteractionsPerState: 10,
      timeoutPerState: 15000,
      totalTimeoutMs: 120000,
      maxRadioDepth,
    });

    logger.info(`Discovery complete: ${matrix.states.size} states, ${matrix.transitions.length} transitions`);

    const featuresDir = path.resolve('src/features');
    mkdirSync(featuresDir, { recursive: true });

    const featureContent = this.buildFeatureFile(scenarios, input.url);
    const featureFileName = `generated_${new URL(input.url).hostname.replace(/\./g, '_')}.feature`;
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
    await generateStepDefsFromMatrixScenarios(scenarios, this.container.llmProvider, { url: input.url });

    return {
      featureFilePath,
      pageObjectPaths: [path.resolve('src/page-objects')],
      stepDefinitionsPath: path.resolve('src/step-definitions/generatedSteps.ts'),
      scenarioCount: scenarios.length,
    };
  }

  private async generateFromInstructions(input: GenerationInput): Promise<GenerationOutput> {
    const instructionsPath = input.config?.instructionsPath || 'instructions-template.csv';
    logger.info(`Starting instructions-based test generation from: ${instructionsPath}`);

    const service = new TestGenerationService({ llmProvider: this.container.llmProvider });
    const result = await service.generateArtifactsFromInstructions(instructionsPath);

    return {
      featureFilePath: result.featureFilePath,
      pageObjectPaths: [result.pageObjectPath],
      stepDefinitionsPath: result.stepDefinitionsPath,
      scenarioCount: 0,
    };
  }

  private buildFeatureFile(
    scenarios: { tags: string[]; name: string; steps: string[] }[],
    url: string
  ): string {
    const hostname = new URL(url).hostname;
    const lines: string[] = [];
    lines.push(`Feature: Flow Matrix Discovery for ${hostname}`);
    lines.push(`  Automatically discovered scenarios via live browser exploration of ${url}`);
    lines.push('');

    for (const scenario of scenarios) {
      if (scenario.tags.length > 0) {
        lines.push(`  ${scenario.tags.map((t) => (t.startsWith('@') ? t : `@${t}`)).join(' ')}`);
      }
      lines.push(`  Scenario: ${scenario.name}`);
      for (const step of scenario.steps) {
        lines.push(`    ${step}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
