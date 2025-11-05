import { ScenarioType } from '../ai/promptTemplates';

export interface ClassifiedScenario {
  title: string;
  type: ScenarioType;
  tags: string[];
  description: string;
  priority: number;
  steps?: string[];
}

export class ScenarioClassifier {
  classifyByKeywords(text: string): ScenarioType {
    const lower = text.toLowerCase();

    const negativeKeywords = [
      'invalid', 'error', 'fail', 'negative', 'wrong', 'incorrect',
      'cannot', 'should not', 'must not', 'unable', 'denied', 'rejected'
    ];

    const edgeCaseKeywords = [
      'boundary', 'edge', 'corner', 'extreme', 'maximum', 'minimum',
      'empty', 'null', 'special character', 'unicode', 'overflow',
      'underflow', 'whitespace', 'leading', 'trailing'
    ];

    const validationKeywords = [
      'validate', 'validation', 'format', 'constraint', 'required',
      'mandatory', 'length', 'pattern', 'regex', 'verify'
    ];

    const workflowKeywords = [
      'workflow', 'journey', 'complete', 'multiple', 'series', 'sequence',
      'navigate', 'navigation', 'process', 'flow'
    ];

    if (negativeKeywords.some(kw => lower.includes(kw))) {
      return 'negative';
    }

    if (edgeCaseKeywords.some(kw => lower.includes(kw))) {
      return 'edge-case';
    }

    if (validationKeywords.some(kw => lower.includes(kw))) {
      return 'validation';
    }

    if (workflowKeywords.some(kw => lower.includes(kw))) {
      return 'workflow';
    }

    return 'happy-path';
  }

  generateTagsForType(type: ScenarioType): string[] {
    const tagMap: Record<ScenarioType, string[]> = {
      'happy-path': ['@positive', '@happy-path', '@smoke'],
      'negative': ['@negative', '@error', '@validation'],
      'edge-case': ['@edge-case', '@boundary', '@corner-case'],
      'validation': ['@validation', '@format', '@constraint'],
      'workflow': ['@workflow', '@integration', '@e2e']
    };

    return tagMap[type] || ['@functional'];
  }

  classifyScenario(title: string): ClassifiedScenario {
    const type = this.classifyByKeywords(title);
    const tags = this.generateTagsForType(type);
    const priority = this.calculatePriority(type, title);
    const description = this.generateDescription(type, title);

    return {
      title,
      type,
      tags,
      description,
      priority
    };
  }

  private calculatePriority(type: ScenarioType, title: string): number {
    let priority = 0;

    const priorityMap: Record<ScenarioType, number> = {
      'happy-path': 10,
      'negative': 8,
      'validation': 7,
      'edge-case': 5,
      'workflow': 9
    };

    priority = priorityMap[type];

    if (title.toLowerCase().includes('login') || title.toLowerCase().includes('auth')) {
      priority += 5;
    }

    if (title.toLowerCase().includes('payment') || title.toLowerCase().includes('purchase')) {
      priority += 4;
    }

    if (title.toLowerCase().includes('security')) {
      priority += 3;
    }

    return Math.min(priority, 20);
  }

  private generateDescription(type: ScenarioType, title: string): string {
    const descriptions: Record<ScenarioType, string> = {
      'happy-path': 'Tests successful user interaction with valid data and expected outcomes',
      'negative': 'Tests error handling and validation with invalid or malformed data',
      'edge-case': 'Tests boundary conditions and special cases that might break functionality',
      'validation': 'Tests input validation, constraints, and data format requirements',
      'workflow': 'Tests complete user workflow spanning multiple interactions'
    };

    return descriptions[type];
  }

  sortScenariosByPriority(scenarios: ClassifiedScenario[]): ClassifiedScenario[] {
    return [...scenarios].sort((a, b) => b.priority - a.priority);
  }

  groupScenariosByType(scenarios: ClassifiedScenario[]): Map<ScenarioType, ClassifiedScenario[]> {
    const grouped = new Map<ScenarioType, ClassifiedScenario[]>();

    for (const scenario of scenarios) {
      if (!grouped.has(scenario.type)) {
        grouped.set(scenario.type, []);
      }
      grouped.get(scenario.type)!.push(scenario);
    }

    return grouped;
  }

  recommendScenarioCount(pageComplexity: 'simple' | 'moderate' | 'complex'): Record<ScenarioType, number> {
    const recommendations: Record<'simple' | 'moderate' | 'complex', Record<ScenarioType, number>> = {
      simple: {
        'happy-path': 2,
        'negative': 1,
        'edge-case': 0,
        'validation': 1,
        'workflow': 0
      },
      moderate: {
        'happy-path': 2,
        'negative': 2,
        'edge-case': 1,
        'validation': 2,
        'workflow': 1
      },
      complex: {
        'happy-path': 3,
        'negative': 3,
        'edge-case': 2,
        'validation': 3,
        'workflow': 2
      }
    };

    return recommendations[pageComplexity];
  }

  assessPageComplexity(
    formCount: number,
    fieldCount: number,
    buttonCount: number
  ): 'simple' | 'moderate' | 'complex' {
    let complexityScore = 0;

    if (formCount === 0) complexityScore += 1;
    else if (formCount === 1) complexityScore += 3;
    else complexityScore += 5;

    if (fieldCount <= 3) complexityScore += 1;
    else if (fieldCount <= 7) complexityScore += 3;
    else complexityScore += 5;

    if (buttonCount <= 2) complexityScore += 1;
    else if (buttonCount <= 5) complexityScore += 2;
    else complexityScore += 3;

    if (complexityScore <= 5) return 'simple';
    if (complexityScore <= 10) return 'moderate';
    return 'complex';
  }

  generateRecommendedScenarios(
    baseTitle: string,
    complexity: 'simple' | 'moderate' | 'complex'
  ): ClassifiedScenario[] {
    const recommendations = this.recommendScenarioCount(complexity);
    const scenarios: ClassifiedScenario[] = [];

    const scenarioTemplates: Record<ScenarioType, string[]> = {
      'happy-path': [
        `${baseTitle} - Happy path`,
        `${baseTitle} - Successful completion`
      ],
      'negative': [
        `${baseTitle} - With invalid input`,
        `${baseTitle} - Error handling`
      ],
      'edge-case': [
        `${baseTitle} - Boundary conditions`,
        `${baseTitle} - Edge cases`
      ],
      'validation': [
        `${baseTitle} - Input validation`,
        `${baseTitle} - Format validation`,
        `${baseTitle} - Constraint checking`
      ],
      'workflow': [
        `${baseTitle} - Complete workflow`,
        `${baseTitle} - Multi-step journey`
      ]
    };

    for (const [type, count] of Object.entries(recommendations) as [ScenarioType, number][]) {
      const templates = scenarioTemplates[type] || [];
      for (let i = 0; i < Math.min(count, templates.length); i++) {
        scenarios.push(this.classifyScenario(templates[i]));
      }
    }

    return scenarios;
  }
}

export const scenarioClassifier = new ScenarioClassifier();
