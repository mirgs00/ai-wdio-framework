import { $ } from '@wdio/globals';
import { validateSelector, SelectorValidationResult } from './selectorValidator';
import { logger } from '../logger';
import * as path from 'path';
import { readFileSync, writeFileSync } from 'fs';

export interface SelectorHealing {
  originalSelector: string;
  brokenReason: string;
  proposedSelectors: string[];
  healed: boolean;
  healedSelector?: string;
}

export interface PageSelectorHealing {
  pageName: string;
  selectorHealings: Record<string, SelectorHealing>;
  totalSelectors: number;
  healed: number;
  failed: number;
}

/**
 * Healing Service
 * Detects broken selectors and attempts to fix them before tests fail
 */
export class HealingService {
  private pageObjectsDir: string = path.resolve('src/page-objects');
  private selectorCache: Map<string, string> = new Map();

  /**
   * Pre-execution check: Validate all selectors before test runs
   */
  async preExecutionValidation(pageNames: string[]): Promise<boolean> {
    logger.info('🔍 Running pre-execution selector validation', {
      section: 'HEALING_SERVICE',
      details: { pageNames, count: pageNames.length }
    });

    let allHealthy = true;

    for (const pageName of pageNames) {
      const isHealthy = await this.validatePageSelectors(pageName);
      if (!isHealthy) {
        allHealthy = false;
      }
    }

    return allHealthy;
  }

  /**
   * Validates selectors for a specific page
   */
  async validatePageSelectors(pageName: string): Promise<boolean> {
    try {
      const filePath = path.join(this.pageObjectsDir, `generated${this.capitalize(pageName)}Page.ts`);
      const content = readFileSync(filePath, 'utf-8');

      // Extract selectors from page object
      const selectors = this.extractSelectors(content);

      if (Object.keys(selectors).length === 0) {
        logger.warn(`No selectors found in ${pageName} page object`, {
          section: 'HEALING_SERVICE'
        });
        return true;
      }

      let validCount = 0;
      const brokenSelectors: Record<string, SelectorValidationResult> = {};

      for (const [name, selector] of Object.entries(selectors)) {
        const result = await validateSelector(selector, 3000);
        if (result.exists) {
          validCount++;
        } else {
          brokenSelectors[name] = result;
        }
      }

      const totalCount = Object.keys(selectors).length;
      const health = Math.round((validCount / totalCount) * 100);

      if (validCount < totalCount) {
        logger.warn(`Page ${pageName} has broken selectors`, {
          section: 'HEALING_SERVICE',
          details: {
            pageName,
            total: totalCount,
            valid: validCount,
            broken: totalCount - validCount,
            health: `${health}%`,
            brokenSelectors: Object.keys(brokenSelectors)
          }
        });
        return false;
      }

      logger.info(`✅ Page ${pageName} selector validation passed (${health}%)`, {
        section: 'HEALING_SERVICE',
        details: { pageName, total: totalCount, valid: validCount, health: `${health}%` }
      });
      return true;
    } catch (error) {
      logger.error(`Error validating selectors for page ${pageName}`, error as Error);
      return false;
    }
  }

  /**
   * Attempts to heal broken selectors by finding new ones
   */
  async healBrokenSelector(selector: string, elementType?: string): Promise<SelectorHealing> {
    logger.info(`🔧 Attempting to heal broken selector: ${selector}`, {
      section: 'HEALING_SERVICE',
      details: { selector, elementType }
    });

    const healing: SelectorHealing = {
      originalSelector: selector,
      brokenReason: 'Element not found',
      proposedSelectors: [],
      healed: false
    };

    try {
      // Try to find the element using alternative selectors
      const alternatives = await this.findElementAlternatives(selector, elementType);

      healing.proposedSelectors = alternatives;

      if (alternatives.length > 0) {
        // Test first alternative
        const element = $(alternatives[0]);
        const exists = await element.isExisting({ timeout: 2000 }).catch(() => false);

        if (exists) {
          healing.healed = true;
          healing.healedSelector = alternatives[0];

          logger.info(`✅ Selector healed successfully`, {
            section: 'HEALING_SERVICE',
            details: {
              original: selector,
              healed: healing.healedSelector
            }
          });
        }
      }
    } catch (error) {
      logger.error(`Failed to heal selector ${selector}`, error as Error);
    }

    return healing;
  }

  /**
   * Finds alternative selectors for a broken element
   */
  async findElementAlternatives(selector: string, elementType?: string): Promise<string[]> {
    const alternatives: string[] = [];

    // Extract element type hints from selector if not provided
    let type = elementType;
    if (!type) {
      if (selector.includes('input')) type = 'input';
      else if (selector.includes('button')) type = 'button';
      else if (selector.includes('error')) type = 'error';
      else if (selector.includes('success')) type = 'success';
    }

    // Common fallback selectors by type
    const fallbacks: Record<string, string[]> = {
      input: [
        'input[type="text"]',
        'input[type="password"]',
        'input',
        '[role="textbox"]',
        '[contenteditable]'
      ],
      button: [
        'button',
        '[role="button"]',
        'a[role="button"]',
        '[onclick]',
        '[data-testid*="button"]'
      ],
      success: [
        '[class*="success"]',
        '[class*="alert"]',
        '[role="alert"]',
        '.success-message',
        '[id*="success"]'
      ],
      error: [
        '[class*="error"]',
        '[class*="danger"]',
        '[role="alert"]',
        '.error-message',
        '[id*="error"]'
      ]
    };

    if (type && fallbacks[type]) {
      alternatives.push(...fallbacks[type]);
    }

    // Add generic alternatives
    alternatives.push(
      '*', // Any element
      '[role="main"]', // Main content
      '[data-testid]' // Elements with testid
    );

    return [...new Set(alternatives)]; // Remove duplicates
  }

  /**
   * Extracts selectors from page object file
   */
  private extractSelectors(content: string): Record<string, string> {
    const selectors: Record<string, string> = {};

    const getterRegex = /get\s+(\w+)\s*\(\s*\)\s*{\s*return\s+\$\(['"`]([^'"`]+)['"`]\)/g;

    let match;
    while ((match = getterRegex.exec(content)) !== null) {
      const name = match[1];
      const selector = match[2];
      selectors[name] = selector;
    }

    return selectors;
  }

  /**
   * Updates page object with healed selectors
   */
  async updatePageObjectWithHealedSelectors(
    pageName: string,
    healings: Record<string, SelectorHealing>
  ): Promise<boolean> {
    try {
      const filePath = path.join(this.pageObjectsDir, `generated${this.capitalize(pageName)}Page.ts`);
      let content = readFileSync(filePath, 'utf-8');

      let updatedCount = 0;

      for (const [getterName, healing] of Object.entries(healings)) {
        if (healing.healed && healing.healedSelector) {
          // Replace the selector in the file
          const regex = new RegExp(
            `(get\\s+${getterName}\\s*\\(\\s*\\)\\s*{\\s*return\\s+\\$\\()['\`]([^'\`]+)['\`]`,
            'g'
          );

          content = content.replace(regex, (match) => {
            updatedCount++;
            return `$1'${healing.healedSelector}'`;
          });

          logger.info(`Updated selector for ${getterName}`, {
            section: 'HEALING_SERVICE',
            details: {
              pageName,
              getterName,
              original: healing.originalSelector,
              healed: healing.healedSelector
            }
          });
        }
      }

      if (updatedCount > 0) {
        writeFileSync(filePath, content, 'utf-8');
        logger.info(`✅ Updated ${pageName} page object with ${updatedCount} healed selectors`, {
          section: 'HEALING_SERVICE',
          details: { pageName, updatedCount }
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Failed to update page object for ${pageName}`, error as Error);
      return false;
    }
  }

  /**
   * Full healing workflow for a broken step
   */
  async healBrokenStep(
    stepName: string,
    selector: string,
    pageName: string,
    elementType?: string
  ): Promise<{ success: boolean; healedSelector?: string }> {
    logger.info(`🔧 Healing broken step: ${stepName}`, {
      section: 'HEALING_SERVICE',
      details: { stepName, selector, pageName, elementType }
    });

    const healing = await this.healBrokenSelector(selector, elementType);

    if (healing.healed) {
      // Update page object
      const updated = await this.updatePageObjectWithHealedSelectors(pageName, {
        [selector]: healing
      });

      return {
        success: updated,
        healedSelector: healing.healedSelector
      };
    }

    return { success: false };
  }

  /**
   * Generates healing report
   */
  generateHealingReport(healings: PageSelectorHealing[]): string {
    let report = '\n═══════════════════════════════════════════════════════════════\n';
    report += '                      HEALING REPORT\n';
    report += '═══════════════════════════════════════════════════════════════\n\n';

    let totalPages = 0;
    let totalSelectors = 0;
    let totalHealed = 0;
    let totalFailed = 0;

    for (const page of healings) {
      totalPages++;
      totalSelectors += page.totalSelectors;
      totalHealed += page.healed;
      totalFailed += page.failed;

      const healRate = page.totalSelectors > 0 ? Math.round((page.healed / page.totalSelectors) * 100) : 0;

      if (page.failed === 0) {
        report += `✅ ${page.pageName}: All selectors healed (${page.healed}/${page.totalSelectors})\n`;
      } else {
        report += `⚠️  ${page.pageName}: Partially healed (${page.healed}/${page.totalSelectors}) - ${healRate}%\n`;
      }
    }

    report += '\n───────────────────────────────────────────────────────────────\n';
    report += `SUMMARY: ${totalHealed}/${totalSelectors} selectors healed across ${totalPages} pages\n`;
    report += '───────────────────────────────────────────────────────────────\n';

    if (totalFailed === 0) {
      report += `🎉 All selectors healed successfully!\n`;
    } else {
      report += `⚠️  ${totalFailed} selectors could not be healed.\n`;
    }

    report += '═══════════════════════════════════════════════════════════════\n';

    return report;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

export const healingService = new HealingService();
