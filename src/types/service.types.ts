import type { LLMProvider } from '../utils/ai/types';

export interface TestGenerationService {
  generateStepImplementation(step: string, context: { pageElements?: string[] }): Promise<string>;
  generateFeatureFile(description: string, pageElements?: string[]): Promise<string>;
  generatePageObject(description: string, pageElements?: string[]): Promise<string>;
}

export interface ServiceContainer {
  llmProvider: LLMProvider;
  testGeneration: TestGenerationService;
  healSelector(selector: string, context: string): Promise<string>;
  generateSuggestions(error: Error, context: string): Promise<string[]>;
}
