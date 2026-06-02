import type { LLMProvider } from '../utils/ai/types';
import { TestGenerationService } from './TestGenerationService';
import { HealingService } from '../utils/healing/healingService';
import { SelectorValidationService } from './SelectorValidationService';
import { TestRunnerService } from './TestRunnerService';

export interface ServiceContainerConfig {
  llmProvider: LLMProvider;
  pageObjectsDir?: string;
}

export class ServiceContainer {
  public llmProvider: LLMProvider;
  public testGenerationService: TestGenerationService;
  public healingService: HealingService;
  public selectorValidationService: SelectorValidationService;
  public testRunnerService: TestRunnerService;

  constructor(config: ServiceContainerConfig) {
    this.llmProvider = config.llmProvider;
    this.testGenerationService = new TestGenerationService({ llmProvider: this.llmProvider });
    this.healingService = new HealingService(config.pageObjectsDir);
    this.selectorValidationService = new SelectorValidationService();
    this.testRunnerService = new TestRunnerService();
  }
}
