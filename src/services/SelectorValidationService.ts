import * as fs from 'fs';
import * as path from 'path';
import {
  validateAllPageSelectors,
  generateValidationReport,
  exportValidationResults,
} from '../utils/healing/selectorValidator';

export class SelectorValidationService {
  /**
   * Validates all generated selectors by checking if they exist in the DOM
   * This is a dry-run check before actual test execution
   */
  async validateSelectors(): Promise<void> {
    try {
      console.log('\n🔍 Starting selector validation...');

      const pageObjectsDir = path.resolve('src/page-objects');
      if (!fs.existsSync(pageObjectsDir)) {
        console.error('❌ No page objects found. Please generate tests first.');
        process.exit(1);
      }

      // Extract page URLs and selectors from generated page objects
      const pages: Record<string, { selectors: Record<string, string>; url?: string }> = {};

      const files = fs
        .readdirSync(pageObjectsDir)
        .filter((f: string) => f.startsWith('generated') && f.endsWith('.ts'));

      for (const file of files) {
        const filePath = path.join(pageObjectsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        // Extract page name
        const pageNameMatch = file.match(/generated(\w+)Page\.ts/);
        const pageName = pageNameMatch ? pageNameMatch[1].toLowerCase() : file.replace(/\.ts$/, '');

        // Extract URL from JSDoc comment or getter
        const urlMatch = content.match(/Page URL:\s*(\S+)/);
        const url = urlMatch ? urlMatch[1] : undefined;

        // Extract all getter methods and their selectors
        const getterRegex = /get\s+(\w+)\s*\(\s*\)\s*{\s*return\s+\$\(['"`]([^'"`]+)['"`]\)/g;
        const selectors: Record<string, string> = {};

        let match;
        while ((match = getterRegex.exec(content)) !== null) {
          const getterName = match[1];
          const selectorText = match[2];
          selectors[getterName] = selectorText;
        }

        if (Object.keys(selectors).length > 0) {
          pages[pageName] = { selectors, url };
        }
      }

      if (Object.keys(pages).length === 0) {
        console.error('❌ No selectors found in page objects.');
        process.exit(1);
      }

      console.log(`\n📋 Found ${Object.keys(pages).length} page object(s) with selectors`);

      // Open browser and validate selectors
      const { remote } = await import('webdriverio');
      const browser = await remote({
        capabilities: { browserName: 'chrome' },
      });

      try {
        const results = [];

        for (const [pageName, pageData] of Object.entries(pages)) {
          if (pageData.url) {
            console.log(`\n🌐 Opening ${pageName} page: ${pageData.url}`);
            await browser.url(pageData.url);

            // Wait for page to load
            await browser.waitUntil(
              async () => (await browser.execute(() => document.readyState)) === 'complete',
              { timeout: 10000 }
            );
          }

          const result = await validateAllPageSelectors({ [pageName]: pageData });
          results.push(...result);
        }

        // Print report
        const report = generateValidationReport(results);
        console.log(report);

        // Export results
        const resultsFile = path.resolve('selector-validation-results.json');
        exportValidationResults(results, resultsFile);

        // Exit with appropriate code
        const hasErrors = results.some((r) => r.invalidSelectors > 0);
        if (hasErrors) {
          console.error('\n❌ Selector validation failed. Some selectors are broken.');
          process.exit(1);
        } else {
          console.log('\n✅ All selectors are valid!');
        }
      } finally {
        await browser.deleteSession();
      }
    } catch (error) {
      console.error('❌ Selector validation error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }
}
