import { browser } from '@wdio/globals';
import * as fs from 'fs';
import * as path from 'path';
import { createOllamaClient } from '../ai/ollamaClient';
import { logger } from '../logger';

export interface LocatorStrategy {
  type: 'id' | 'xpath' | 'css' | 'text' | 'aria' | 'testid' | 'role' | 'composite';
  selector: string;
  priority: number;
  description?: string;
}

export interface SmartLocatorCache {
  [key: string]: {
    strategies: LocatorStrategy[];
    successCount: number;
    failureCount: number;
    lastUsed: number;
  };
}

export interface ElementDescription {
  text?: string;
  placeholder?: string;
  ariaLabel?: string;
  type?: string;
  role?: string;
  className?: string;
}

/**
 * SmartLocator - Intelligent element finding with multiple strategies
 * Features:
 * - Multiple fallback strategies for resilience
 * - AI-powered element recognition
 * - Learning from past successful locators
 * - Caching for performance
 * - Resilience to minor DOM changes
 */
export class SmartLocator {
  private cache: SmartLocatorCache = {};
  private cacheFile: string;
  private aiEnabled: boolean;
  private maxRetries: number = 3;

  constructor(cacheDir?: string, enableAI: boolean = true) {
    this.cacheFile = path.join(cacheDir || './build', 'locator-cache.json');
    this.aiEnabled = enableAI;
    this.loadCache();
  }

  /**
   * Find element with smart strategies and fallbacks
   */
  async findElement(
    description: ElementDescription | string,
    context: string = 'main'
  ) {
    try {
      const cacheKey = this.generateCacheKey(description);
      
      // Try cached strategies first
      if (this.cache[cacheKey]) {
        const cached = this.cache[cacheKey];
        const strategies = cached.strategies.sort((a, b) => b.priority - a.priority);
        
        for (const strategy of strategies) {
          try {
            const element = await this.tryLocatorStrategy(strategy);
            if (element) {
              this.recordSuccess(cacheKey, strategy);
              return element;
            }
          } catch (e) {
            logger.debug(`Strategy ${strategy.type} failed for ${cacheKey}`);
          }
        }
      }

      // Generate new strategies if cache miss
      const strategies = await this.generateLocatorStrategies(description, context);
      
      // Try each strategy in order
      for (const strategy of strategies) {
        try {
          const element = await this.tryLocatorStrategy(strategy);
          if (element) {
            this.recordSuccess(cacheKey, strategy);
            this.cache[cacheKey] = {
              strategies,
              successCount: 1,
              failureCount: 0,
              lastUsed: Date.now(),
            };
            this.saveCache();
            return element;
          }
        } catch (e) {
          logger.debug(`Strategy ${strategy.type} failed: ${e}`);
        }
      }

      throw new Error(`Could not find element matching description: ${JSON.stringify(description)}`);
    } catch (error) {
      logger.error(`SmartLocator findElement failed: ${error}`);
      throw error;
    }
  }

  /**
   * Generate multiple locator strategies with priorities
   */
  private async generateLocatorStrategies(
    description: ElementDescription | string,
    context: string
  ): Promise<LocatorStrategy[]> {
    const strategies: LocatorStrategy[] = [];
    const desc = typeof description === 'string' ? { text: description } : description;

    // 1. ID-based (highest priority if available)
    if (desc.text) {
      strategies.push({
        type: 'id',
        selector: this.generateIdSelector(desc.text),
        priority: 100,
        description: 'ID selector',
      });
    }

    // 2. Data-testid based
    if (desc.text) {
      strategies.push({
        type: 'testid',
        selector: `[data-testid="${this.sanitize(desc.text)}"]`,
        priority: 95,
        description: 'Data-testid selector',
      });
    }

    // 3. Aria-label based
    if (desc.ariaLabel) {
      strategies.push({
        type: 'aria',
        selector: `[aria-label="${desc.ariaLabel}"]`,
        priority: 90,
        description: 'Aria-label selector',
      });
    }

    // 4. Placeholder-based
    if (desc.placeholder) {
      strategies.push({
        type: 'css',
        selector: `[placeholder="${desc.placeholder}"]`,
        priority: 85,
        description: 'Placeholder selector',
      });
    }

    // 5. Role-based
    if (desc.role) {
      strategies.push({
        type: 'role',
        selector: `[role="${desc.role}"]`,
        priority: 80,
        description: 'Role selector',
      });
    }

    // 6. Text content-based
    if (desc.text && desc.text.length < 50) {
      strategies.push({
        type: 'text',
        selector: `//*[contains(text(), "${desc.text}")]`,
        priority: 75,
        description: 'XPath text selector',
      });
    }

    // 7. Type-based CSS
    if (desc.type) {
      strategies.push({
        type: 'css',
        selector: `${desc.type || '*'}[type="${desc.type}"]`,
        priority: 70,
        description: 'Type selector',
      });
    }

    // 8. Composite strategy (combination of attributes)
    strategies.push({
      type: 'composite',
      selector: this.generateCompositeSelector(desc),
      priority: 65,
      description: 'Composite selector with multiple attributes',
    });

    // 9. Fuzzy XPath (tolerant to minor changes)
    strategies.push({
      type: 'xpath',
      selector: this.generateFuzzyXPath(desc),
      priority: 60,
      description: 'Fuzzy XPath for DOM resilience',
    });

    // 10. AI-powered if enabled
    if (this.aiEnabled) {
      try {
        const aiStrategy = await this.generateAILocatorStrategy(desc, context);
        if (aiStrategy) {
          aiStrategy.priority = 50;
          strategies.push(aiStrategy);
        }
      } catch (e) {
        logger.debug(`AI strategy generation failed: ${e}`);
      }
    }

    return strategies;
  }

  /**
   * Generate AI-powered locator strategy
   */
  private async generateAILocatorStrategy(
    desc: ElementDescription,
    context: string
  ): Promise<LocatorStrategy | null> {
    try {
      const currentDOM = await browser.getPageSource();
      const elementInfo = JSON.stringify(desc, null, 2);

      const prompt = `Given the following page element description and current DOM structure, provide the most reliable CSS or XPath selector to find this element:

Element Description:
${elementInfo}

Context: ${context}

Current page has these elements. Find the most reliable selector.

Respond with ONLY a valid CSS or XPath selector, no explanation. Choose between:
1. CSS selector (e.g., '#id', '.class', '[attr="value"]')
2. XPath selector (e.g., '//button[@class="primary"]')

Best selector:`;

      const ollamaClient = createOllamaClient();
      const response = await ollamaClient.generateText(prompt, {
        temperature: 0.3,
        max_tokens: 100,
      });

      const selector = response.trim().split('\n')[0];
      
      if (selector && (selector.startsWith('/') || selector.startsWith('[') || selector.startsWith('.'))) {
        return {
          type: 'composite',
          selector,
          priority: 50,
          description: 'AI-generated selector',
        };
      }
    } catch (e) {
      logger.debug(`AI locator strategy generation failed: ${e}`);
    }
    return null;
  }

  /**
   * Try a specific locator strategy
   */
  private async tryLocatorStrategy(strategy: LocatorStrategy) {
    try {
      let element;
      
      if (strategy.selector.startsWith('//') || strategy.selector.includes('xpath')) {
        element = await browser.$(`xpath=${strategy.selector}`);
      } else {
        element = await browser.$(strategy.selector);
      }

      if (element && (await element.isDisplayed())) {
        return element;
      }
    } catch (e) {
      logger.debug(`Strategy ${strategy.type} with selector ${strategy.selector} failed`);
    }
    return null;
  }

  /**
   * Generate composite selector combining multiple attributes
   */
  private generateCompositeSelector(desc: ElementDescription): string {
    const parts: string[] = [];

    if (desc.text) {
      parts.push(`contains(text(), "${desc.text}")`);
    }
    if (desc.placeholder) {
      parts.push(`@placeholder="${desc.placeholder}"`);
    }
    if (desc.ariaLabel) {
      parts.push(`@aria-label="${desc.ariaLabel}"`);
    }
    if (desc.role) {
      parts.push(`@role="${desc.role}"`);
    }
    if (desc.type) {
      parts.push(`@type="${desc.type}"`);
    }

    if (parts.length === 0) {
      return '//*';
    }

    return `//*[${parts.join(' and ')}]`;
  }

  /**
   * Generate fuzzy XPath tolerant to minor DOM changes
   */
  private generateFuzzyXPath(desc: ElementDescription): string {
    const parts: string[] = [];

    if (desc.text) {
      parts.push(
        `//*[normalize-space(.) = "${desc.text}" or contains(normalize-space(.), "${desc.text.substring(0, 10)}")]`
      );
    }

    if (desc.type) {
      parts.push(`//input[@type="${desc.type}"]`);
    }

    if (desc.role) {
      parts.push(`//*[@role="${desc.role}"]`);
    }

    if (desc.ariaLabel) {
      parts.push(`//*[@aria-label="${desc.ariaLabel}"]`);
    }

    return parts.length > 0 ? parts[0] : '//*';
  }

  /**
   * Generate ID selector safely
   */
  private generateIdSelector(text: string): string {
    const id = this.sanitize(text).toLowerCase();
    return `#${id}`;
  }

  /**
   * Generate cache key from description
   */
  private generateCacheKey(description: ElementDescription | string): string {
    if (typeof description === 'string') {
      return this.sanitize(description);
    }
    const parts = [
      description.text,
      description.ariaLabel,
      description.placeholder,
      description.type,
      description.role,
    ]
      .filter(Boolean)
      .map((p) => this.sanitize(p!))
      .join('_');
    return parts || 'unknown';
  }

  /**
   * Sanitize text for use in selectors and cache keys
   */
  private sanitize(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
  }

  /**
   * Record successful locator use
   */
  private recordSuccess(cacheKey: string, strategy: LocatorStrategy): void {
    if (this.cache[cacheKey]) {
      const cached = this.cache[cacheKey];
      const existing = cached.strategies.find((s) => s.selector === strategy.selector);
      if (existing) {
        existing.priority += 5; // Boost priority
      }
      cached.successCount++;
      cached.lastUsed = Date.now();
    }
  }

  /**
   * Load cache from file
   */
  private loadCache(): void {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = fs.readFileSync(this.cacheFile, 'utf-8');
        this.cache = JSON.parse(data);
        logger.debug(`Loaded locator cache with ${Object.keys(this.cache).length} entries`);
      }
    } catch (e) {
      logger.debug(`Could not load locator cache: ${e}`);
    }
  }

  /**
   * Save cache to file
   */
  private saveCache(): void {
    try {
      const cacheDir = path.dirname(this.cacheFile);
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      fs.writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2));
    } catch (e) {
      logger.warn(`Could not save locator cache: ${e}`);
    }
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache = {};
    this.saveCache();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalCached: number;
    successfulStrategies: number;
    averageSuccessRate: number;
  } {
    let totalStrategies = 0;
    let totalSuccess = 0;

    Object.values(this.cache).forEach((entry) => {
      totalStrategies += entry.strategies.length;
      totalSuccess += entry.successCount;
    });

    return {
      totalCached: Object.keys(this.cache).length,
      successfulStrategies: totalSuccess,
      averageSuccessRate: totalSuccess > 0 ? (totalSuccess / totalStrategies) * 100 : 0,
    };
  }
}

// Singleton instance
export const smartLocator = new SmartLocator();