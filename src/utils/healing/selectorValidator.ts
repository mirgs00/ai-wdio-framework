import { $ } from '@wdio/globals';
import { logger } from '../logger';

export interface SelectorValidationResult {
  selector: string;
  exists: boolean;
  error?: string;
}

export interface PageSelectorValidationResult {
  pageName: string;
  pageUrl?: string;
  totalSelectors: number;
  validSelectors: number;
  invalidSelectors: number;
  results: SelectorValidationResult[];
  isHealthy: boolean;
  healthPercentage: number;
}

/**
 * Validates if a selector exists in the DOM
 * Used for pre-execution validation to catch broken selectors early
 */
export async function validateSelector(
  selector: string,
  timeout: number = 2000
): Promise<SelectorValidationResult> {
  try {
    const element = $(selector);
    const exists = await element.isExisting({ timeout });
    return {
      selector,
      exists,
      error: exists ? undefined : 'Selector did not match any elements',
    };
  } catch (error) {
    return {
      selector,
      exists: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Validates multiple selectors from a page object
 */
export async function validatePageSelectors(
  pageName: string,
  selectors: Record<string, string>,
  pageUrl?: string
): Promise<PageSelectorValidationResult> {
  logger.info(`🔍 Validating selectors for page: ${pageName}`, {
    section: 'SELECTOR_VALIDATION',
    details: { pageName, selectorCount: Object.keys(selectors).length, pageUrl },
  });

  const results: SelectorValidationResult[] = [];
  let validCount = 0;

  for (const [name, selector] of Object.entries(selectors)) {
    const result = await validateSelector(selector);
    results.push({
      selector: `${name}: ${selector}`,
      exists: result.exists,
      error: result.error,
    });

    if (result.exists) {
      validCount++;
    } else {
      logger.warn(`❌ Invalid selector: ${name}`, {
        section: 'SELECTOR_VALIDATION',
        details: { selector, error: result.error },
      });
    }
  }

  const totalSelectors = Object.keys(selectors).length;
  const invalidSelectors = totalSelectors - validCount;
  const healthPercentage =
    totalSelectors > 0 ? Math.round((validCount / totalSelectors) * 100) : 100;
  const isHealthy = invalidSelectors === 0;

  const validation: PageSelectorValidationResult = {
    pageName,
    pageUrl,
    totalSelectors,
    validSelectors: validCount,
    invalidSelectors,
    results,
    isHealthy,
    healthPercentage,
  };

  logger.info(`📊 Selector validation complete for ${pageName}`, {
    section: 'SELECTOR_VALIDATION',
    details: {
      pageName,
      totalSelectors,
      validSelectors: validCount,
      invalidSelectors,
      healthPercentage: `${healthPercentage}%`,
      isHealthy,
    },
  });

  return validation;
}

/**
 * Validates selectors for multiple pages
 */
export async function validateAllPageSelectors(
  pages: Record<string, { selectors: Record<string, string>; url?: string }>
): Promise<PageSelectorValidationResult[]> {
  const results: PageSelectorValidationResult[] = [];

  for (const [pageName, pageData] of Object.entries(pages)) {
    const validation = await validatePageSelectors(pageName, pageData.selectors, pageData.url);
    results.push(validation);
  }

  return results;
}

/**
 * Generates a validation report
 */
export function generateValidationReport(results: PageSelectorValidationResult[]): string {
  let report = '\n═══════════════════════════════════════════════════════════════\n';
  report += '                    SELECTOR VALIDATION REPORT\n';
  report += '═══════════════════════════════════════════════════════════════\n\n';

  let totalPages = 0;
  let healthyPages = 0;
  let totalSelectors = 0;
  let totalValid = 0;
  let totalInvalid = 0;

  for (const page of results) {
    totalPages++;
    totalSelectors += page.totalSelectors;
    totalValid += page.validSelectors;
    totalInvalid += page.invalidSelectors;

    if (page.isHealthy) {
      healthyPages++;
      report += `✅ ${page.pageName}: ${page.healthPercentage}% (${page.validSelectors}/${page.totalSelectors})\n`;
    } else {
      report += `❌ ${page.pageName}: ${page.healthPercentage}% (${page.validSelectors}/${page.totalSelectors})\n`;
      for (const result of page.results) {
        if (!result.exists) {
          report += `   - ${result.selector}\n`;
          if (result.error) {
            report += `     Error: ${result.error}\n`;
          }
        }
      }
    }
  }

  report += '\n───────────────────────────────────────────────────────────────\n';
  report += `SUMMARY: ${healthyPages}/${totalPages} pages healthy | ${totalValid}/${totalSelectors} selectors valid\n`;
  report += '───────────────────────────────────────────────────────────────\n';

  const overallHealth = totalSelectors > 0 ? Math.round((totalValid / totalSelectors) * 100) : 100;
  if (totalInvalid === 0) {
    report += `🎉 All selectors are valid! (${overallHealth}% health)\n`;
  } else {
    report += `⚠️  ${totalInvalid} selector(s) are broken. (${overallHealth}% health)\n`;
  }

  report += '═══════════════════════════════════════════════════════════════\n';

  return report;
}

/**
 * Exports validation results to JSON for analysis
 */
export function exportValidationResults(
  results: PageSelectorValidationResult[],
  filePath: string
): void {
  const fs = require('fs');
  const data = {
    timestamp: new Date().toISOString(),
    summary: {
      totalPages: results.length,
      healthyPages: results.filter((r) => r.isHealthy).length,
      totalSelectors: results.reduce((sum, r) => sum + r.totalSelectors, 0),
      validSelectors: results.reduce((sum, r) => sum + r.validSelectors, 0),
      invalidSelectors: results.reduce((sum, r) => sum + r.invalidSelectors, 0),
    },
    results,
  };

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  logger.info(`📁 Validation results exported to ${filePath}`, {
    section: 'SELECTOR_VALIDATION',
    details: { filePath },
  });
}
