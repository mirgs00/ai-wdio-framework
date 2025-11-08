import { browser } from '@wdio/globals';
import { writeFileSync, readFileSync } from 'fs';
import * as path from 'path';
import { analyzeDOM } from '../dom/domAnalyzer';
import { buildPageObjects } from '../test-gen/pageObjectBuilder';
import { fetchDOM } from '../dom/domParser';

export interface RegenerationContext {
  stepText: string;
  pageName: string;
  errorMessage: string;
  pageUrl: string;
}

class AutoRegenerateService {
  private maxRegenerationAttempts = 1;
  private regeneratedPages = new Set<string>();

  /**
   * Attempt to regenerate page objects from current DOM on failure
   * This is triggered by the healing hooks when a step fails
   */
  async regenerateFromCurrentDOM(context: RegenerationContext): Promise<boolean> {
    const cacheKey = context.pageName;

    if (this.regeneratedPages.has(cacheKey)) {
      console.log(`⏭️ Already regenerated ${context.pageName} in this scenario`);
      return false;
    }

    console.log(`🔄 Auto-regenerating ${context.pageName} page object from current DOM...`);

    try {
      // Get current page HTML
      const domHtml = await this.getCurrentPageHTML();
      
      if (!domHtml) {
        console.warn('⚠️ Could not capture page HTML');
        return false;
      }

      // Analyze the current DOM
      const pageAnalysis = analyzeDOM(domHtml);

      console.log(`📊 Found elements on ${context.pageName}:`);
      console.log(`  - Inputs: ${pageAnalysis.inputFields.length}`);
      console.log(`  - Buttons: ${pageAnalysis.buttons.length}`);
      console.log(`  - Error elements: ${pageAnalysis.errorElements.length}`);
      console.log(`  - Success elements: ${pageAnalysis.successElements.length}`);

      // Update the page object file
      const success = await this.updatePageObjectFromAnalysis(
        context.pageName,
        pageAnalysis,
        domHtml
      );

      if (success) {
        this.regeneratedPages.add(cacheKey);
        console.log(`✅ Successfully regenerated ${context.pageName} page object`);
        console.log(`💡 The new page object will be used on retry`);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`❌ Regeneration failed: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }

  /**
   * Get current page HTML
   * Waits for dynamic content to be rendered before capturing
   */
  private async getCurrentPageHTML(): Promise<string> {
    try {
      console.log(`⏳ Waiting for dynamic content to render...`);
      
      await browser.waitUntil(
        async () => {
          const readyState = await browser.execute(() => document.readyState);
          return readyState === 'complete';
        },
        { timeout: 5000, timeoutMsg: 'Page did not reach ready state' }
      );

      await browser.pause(500);

      const html = await browser.execute(() => {
        return document.documentElement.outerHTML;
      });

      if (!html) {
        console.warn('⚠️ Page HTML is empty');
        return '';
      }

      const elementCount = await browser.execute(() => {
        return {
          total: document.querySelectorAll('*').length,
          inputs: document.querySelectorAll('input, textarea, select').length,
          buttons: document.querySelectorAll('button, [role="button"]').length,
          divs: document.querySelectorAll('div').length,
          spans: document.querySelectorAll('span').length,
          headings: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length
        };
      });

      console.log(`✅ DOM captured (Ready State: complete)`);
      console.log(`   Elements found:`);
      console.log(`   - Total: ${elementCount.total}`);
      console.log(`   - Inputs/Selects: ${elementCount.inputs}`);
      console.log(`   - Buttons: ${elementCount.buttons}`);
      console.log(`   - Divs: ${elementCount.divs}`);
      console.log(`   - Spans: ${elementCount.spans}`);
      console.log(`   - Headings: ${elementCount.headings}`);

      return html;
    } catch (error) {
      console.warn(`Failed to capture page HTML: ${error instanceof Error ? error.message : error}`);
      return '';
    }
  }

  /**
   * Update page object file based on DOM analysis
   */
  private async updatePageObjectFromAnalysis(
    pageName: string,
    pageAnalysis: any,
    htmlContent: string
  ): Promise<boolean> {
    try {
      // Detect the actual page type from content
      const detectedPageType = this.detectPageType(htmlContent);
      const finalPageName = pageName || detectedPageType;
      const pageObjectPath = path.resolve(`src/page-objects/generated${this.capitalize(finalPageName)}Page.ts`);

      console.log(`\n📊 DOM Analysis Complete:`);
      console.log(`   Page Type: ${finalPageName}`);
      console.log(`   Input Fields: ${pageAnalysis.inputFields.length}`);
      console.log(`   Buttons: ${pageAnalysis.buttons.length}`);
      console.log(`   Links: ${pageAnalysis.links.length}`);
      console.log(`   Headings: ${pageAnalysis.headings.length}`);
      console.log(`   Error Elements: ${pageAnalysis.errorElements.length}`);
      console.log(`   Success Elements: ${pageAnalysis.successElements.length}`);
      console.log(`   Text Elements: ${pageAnalysis.textElements?.length || 0}`);
      
      if (pageAnalysis.headings.length > 0) {
        console.log(`\n   Headings found:`);
        pageAnalysis.headings.forEach((h: any) => {
          console.log(`     - H${h.level}: "${h.text}"`);
        });
      }

      if (pageAnalysis.successElements.length > 0) {
        console.log(`\n   Success Elements found:`);
        pageAnalysis.successElements.forEach((s: any) => {
          console.log(`     - ${s.selector}: ${s.description}`);
        });
      }

      // Generate page object code with all detected elements
      const pageObjectCode = this.generatePageObjectCode(
        finalPageName,
        pageAnalysis,
        htmlContent
      );

      writeFileSync(pageObjectPath, pageObjectCode, 'utf-8');
      console.log(`\n📝 Updated: ${pageObjectPath}`);

      return true;
    } catch (error) {
      console.warn(`Could not update page object: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }

  /**
   * Detect page type from DOM content
   */
  private detectPageType(htmlContent: string): string {
    const content = htmlContent.toLowerCase();
    
    // Detect dashboard/success page
    if (content.includes('logged in') || content.includes('logged-in') || content.includes('dashboard')) {
      return 'dashboard';
    }
    
    // Detect error page
    if (content.includes('error') && !content.includes('password')) {
      return 'error';
    }
    
    // Default to login
    return 'login';
  }

  /**
   * Generate complete page object code from DOM analysis
   */
  private generatePageObjectCode(
    pageName: string,
    analysis: any,
    htmlContent: string
  ): string {
    const className = this.capitalize(pageName) + 'Page';
    const instanceName = pageName.toLowerCase() + 'Page';

    // Build all element getters
    const elementGetters: string[] = [];

    // Add input fields
    analysis.inputFields.forEach((field: any, idx: number) => {
      const name = field.name || `input${idx}`;
      elementGetters.push(`
  /**
   * ${field.label || field.placeholder || `Input field: ${name}`}
   */
  get ${this.toCamelCase(name + '_input')}() {
    return $('${field.selector.replace(/'/g, "\\'")}');
  }`);
    });

    // Add buttons
    analysis.buttons.forEach((btn: any, idx: number) => {
      const name = btn.text || `button${idx}`;
      elementGetters.push(`
  /**
   * ${btn.text || 'Button'}
   */
  get ${this.toCamelCase(name + '_button')}() {
    return $('${btn.selector.replace(/'/g, "\\'")}');
  }`);
    });

    // Add error elements
    analysis.errorElements.forEach((err: any, idx: number) => {
      const name = err.selector.replace(/[#.\[\]"=]/g, '') || `error${idx}`;
      elementGetters.push(`
  /**
   * ${err.description}
   */
  get ${this.toCamelCase(name + '_error')}() {
    return $('${err.selector.replace(/'/g, "\\'")}');
  }`);
    });

    // Add success elements
    analysis.successElements.forEach((succ: any, idx: number) => {
      const name = succ.selector.replace(/[#.\[\]"=]/g, '') || `success${idx}`;
      elementGetters.push(`
  /**
   * ${succ.description}
   */
  get ${this.toCamelCase(name + '_success')}() {
    return $('${succ.selector.replace(/'/g, "\\'")}');
  }`);
    });

    // Add headings
    analysis.headings.forEach((heading: any, idx: number) => {
      elementGetters.push(`
  /**
   * Heading: ${heading.text}
   */
  get ${this.toCamelCase((heading.text || `heading${idx}`) + '_heading')}() {
    return $('${heading.selector.replace(/'/g, "\\'")}');
  }`);
    });

    // Add generic text elements
    if (analysis.textElements && analysis.textElements.length > 0) {
      analysis.textElements.forEach((textEl: any, idx: number) => {
        const name = textEl.text.substring(0, 30).replace(/[^a-zA-Z0-9\s]/g, ' ').trim().replace(/\s+/g, '_');
        if (name.length > 0) {
          elementGetters.push(`
  /**
   * Text element: ${textEl.text.substring(0, 50)}
   */
  get ${this.toCamelCase(name + '_text')}() {
    return $('${textEl.selector.replace(/'/g, "\\'")}');
  }`);
        }
      });
    }

    const pageUrl = analysis.forms?.[0]?.action || 'https://practicetestautomation.com/practice-test-login/';

    return `// Auto-generated Page Object for ${pageName} page
// Regenerated: ${new Date().toISOString()}
// Auto-healing enabled: DOM re-scanned and updated
import { $, browser } from '@wdio/globals';

class ${className} {
${elementGetters.join('')}

  // Common actions
  async open() {
    await browser.url('${pageUrl.replace(/'/g, "\\'")}');
    await this.waitForPageLoad();
  }

  async waitForPageLoad() {
    await browser.waitUntil(
      async () => (await browser.execute(() => document.readyState)) === 'complete',
      { timeout: 15000, timeoutMsg: 'Page did not load' }
    );
  }
}

export default new ${className}();`;
  }

  private toCamelCase(str: string): string {
    return str
      .replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, index) => {
        if (+match === 0) return '';
        return index === 0 ? match.toLowerCase() : match.toUpperCase();
      })
      .replace(/[^\w]/gi, '');
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Reset regeneration cache (per scenario)
   */
  reset(): void {
    this.regeneratedPages.clear();
  }
}

export const autoRegenerateService = new AutoRegenerateService();
