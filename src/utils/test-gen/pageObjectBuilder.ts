// src/utils/test-gen/pageObjectBuilder.ts
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import * as path from 'path';
import { OllamaClient } from '../ai/ollamaClient';
import { analyzeDOM } from '../dom/domAnalyzer';

const PAGE_OBJECTS_PATH = path.resolve('src/page-objects');
const GENERATED_PAGE_FILE = path.join(PAGE_OBJECTS_PATH, 'generatedPage.ts');

interface PageElement {
  name: string;
  selector: string;
  description: string;
}

function toCamelCase(str: string): string {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, index) => {
      if (+match === 0) return '';
      return index === 0 ? match.toLowerCase() : match.toUpperCase();
    })
    .replace(/[^\w]/gi, '');
}

/**
 * Generates a page object file by analyzing the DOM of a given URL.
 * Identifies interactive elements (inputs, buttons, links) and creates getters for them.
 * 
 * @param url - The URL of the web page to analyze
 * @param htmlContent - Optional HTML content. If not provided, will be fetched from the URL
 * @returns Promise that resolves when page object file is successfully written
 * @throws Error if URL is invalid or page object generation fails
 */
export async function buildPageObjects(url: string, htmlContent?: string): Promise<void> {
  console.log(`🚀 Starting page object generation for: ${url}`);
  
  if (!existsSync(PAGE_OBJECTS_PATH)) {
    mkdirSync(PAGE_OBJECTS_PATH, { recursive: true });
  }

  const pageElements = await identifyPageElements(url, htmlContent);
  
  const pageObjectCode = generatePageObjectFile(pageElements, url);
  writeFileSync(GENERATED_PAGE_FILE, pageObjectCode, 'utf-8');
  
  console.log(`✅ Successfully generated page objects for ${url}`);
}

async function identifyPageElements(url: string, htmlContent?: string): Promise<PageElement[]> {
  if (htmlContent) {
    try {
      console.log('📄 Analyzing actual DOM from HTML...');
      const analysis = analyzeDOM(htmlContent);
      const elements: PageElement[] = [];

      if (analysis.inputFields.length > 0) {
        analysis.inputFields.forEach((field, idx) => {
          const name = field.name || `field${idx}`;
          elements.push({
            name: toCamelCase(`${name}_input`),
            selector: field.selector,
            description: field.label || field.placeholder || `Input field: ${name}`
          });
        });
      }

      if (analysis.buttons.length > 0) {
        analysis.buttons.forEach((btn, idx) => {
          const name = btn.text || `button${idx}`;
          elements.push({
            name: toCamelCase(`${name}_button`),
            selector: btn.selector,
            description: btn.text || `Button element`
          });
        });
      }

      if (analysis.links.length > 0) {
        analysis.links.forEach((link, idx) => {
          const name = link.text || `link${idx}`;
          elements.push({
            name: toCamelCase(`${name}_link`),
            selector: link.selector,
            description: `Link: ${link.text}`
          });
        });
      }

      if (elements.length > 0) {
        console.log(`✅ Found ${elements.length} elements in actual DOM`);
        return elements;
      }
    } catch (error) {
      console.warn('Failed to analyze DOM:', error instanceof Error ? error.message : error);
    }
  }

  console.log('⚙️ Using WebdriverIO fallback...');
  return getDefaultElements(url);
}

async function getDefaultElements(url: string): Promise<PageElement[]> {
  try {
    const { remote } = await import('webdriverio');
    const browser = await remote({
      capabilities: { browserName: 'chrome' }
    });

    await browser.url(url);
    
    const elements = await browser.$$([
      'input', 
      'button', 
      'a', 
      'select', 
      'textarea',
      '[role=button]',
      '[onclick]',
      '[data-testid]'
    ].join(','));

    const pageElements: PageElement[] = [];
    
    for (const element of elements) {
      try {
        const tagName = await element.getTagName();
        const id = await element.getAttribute('id');
        const name = await element.getAttribute('name');
        const testId = await element.getAttribute('data-testid');
        const role = await element.getAttribute('role');
        const classNames = await element.getAttribute('class');
        const text = await element.getText();

        // Generate a unique name - include tag name and identifier
        const identifier = id || name || testId || role || (classNames ? classNames.split(' ')[0] : '');
        let elementName = identifier 
          ? toCamelCase(`${tagName}_${identifier}`)
          : toCamelCase(`${tagName}_element_${pageElements.length}`);
        
        // Ensure uniqueness by appending counter if needed
        let uniqueName = elementName;
        let counter = 1;
        while (pageElements.some(el => el.name === uniqueName)) {
          uniqueName = `${elementName}${counter}`;
          counter++;
        }
        elementName = uniqueName;

        // Create the best possible selector
        let selector = '';
        if (id) {
          selector = `#${id}`;
        } else if (name) {
          selector = `[name="${name}"]`;
        } else if (testId) {
          selector = `[data-testid="${testId}"]`;
        } else {
          const attributes = await browser.execute((el) => {
            return Array.from(el.attributes).reduce((acc, attr) => {
              acc[attr.name] = attr.value;
              return acc;
            }, {} as Record<string, string>);
          }, element);

          const attrSelector = Object.entries(attributes)
            .filter(([k]) => !['class', 'style', 'id', 'name'].includes(k))
            .map(([k, v]) => `[${k}="${v}"]`)
            .join('');
          
          selector = `${tagName}${attrSelector}`;
        }

        pageElements.push({
          name: elementName,
          selector: selector.replace(/"/g, '\\"'),
          description: `${tagName} element${text ? ` with text "${text.substring(0, 20)}..."` : ''}`
        });
      } catch (err: unknown) {
        if (err instanceof Error) {
          console.warn(`Couldn't analyze element: ${err.message}`);
        } else {
          console.warn('Couldn\'t analyze element due to unknown error');
        }
      }
    }

    await browser.deleteSession();
    return pageElements;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Failed to dynamically analyze page:', error.message);
    } else {
      console.error('Failed to dynamically analyze page due to unknown error');
    }
    // Ultimate fallback
    return [
      {
        name: "mainForm",
        selector: "form",
        description: "Main form on the page"
      },
      {
        name: "primaryButton",
        selector: "button.primary, button[type='submit']",
        description: "Primary action button"
      }
    ];
  }
}

function generatePageObjectFile(elements: PageElement[], url: string): string {
  // Deduplicate elements by name, keeping the first occurrence
  const uniqueElements = Array.from(
    new Map(elements.map(el => [el.name, el])).values()
  );
  
  const elementsCode = uniqueElements.map(el => {
    return `  /**
   * ${el.description}
   */
  get ${el.name}() {
    return $('${el.selector.replace(/'/g, "\\'")}');
  }`;
  }).join('\n\n');

  return `// Auto-generated Page Object for: ${url}
import { $, browser } from '@wdio/globals';

class GeneratedPage {
${elementsCode}

  // Common actions
  async open() {
    await browser.url('${url.replace(/'/g, "\\'")}');
    await this.waitForPageLoad();
  }

  async waitForPageLoad() {
    await browser.waitUntil(
      async () => (await browser.execute(() => document.readyState)) === 'complete',
      { timeout: 15000, timeoutMsg: 'Page did not load' }
    );
  }
}

export default new GeneratedPage();`;
}