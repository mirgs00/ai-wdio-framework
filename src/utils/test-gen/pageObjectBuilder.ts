// src/utils/test-gen/pageObjectBuilder.ts
import 'dotenv/config';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import * as path from 'path';
import { OllamaClient } from '../ai/ollamaClient';
import { analyzeDOM } from '../dom/domAnalyzer';
import { logger } from '../logger';

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
 * Generates separate page objects for login, dashboard, and error pages.
 *
 * ⚠️ IMPORTANT FOR DYNAMIC CONTENT:
 * If you're calling this during test execution (e.g., in healing/auto-regeneration),
 * the htmlContent parameter should be captured from the live browser using:
 *   const html = await browser.execute(() => document.documentElement.outerHTML);
 * This ensures dynamically generated elements are included in the page object.
 *
 * @param url - The URL of the web page to analyze
 * @param htmlContent - Optional HTML content (should be from live page if capturing dynamic elements)
 * @returns Promise that resolves when page object file is successfully written
 * @throws Error if URL is invalid or page object generation fails
 */
export async function buildPageObjects(url: string, htmlContent?: string): Promise<void> {
  logger.info(`🚀 Starting page object generation for: ${url}`, { section: 'PAGE_OBJECT_BUILD' });

  if (!existsSync(PAGE_OBJECTS_PATH)) {
    mkdirSync(PAGE_OBJECTS_PATH, { recursive: true });
  }

  const pageElements = await identifyPageElements(url, htmlContent);

  // Generate generic page object (for backward compatibility)
  const pageObjectCode = generatePageObjectFile(pageElements, url);
  writeFileSync(GENERATED_PAGE_FILE, pageObjectCode, 'utf-8');
  logger.logPageObjectGeneration('generic', url, pageElements.length, 'generatedPage.ts');

  // Detect page type and generate specific page objects
  if (htmlContent) {
    const pageType = detectPageType(htmlContent, url);
    const pageObjectsByType = generatePageObjectsByType(pageElements, url, pageType);

    for (const [pageName, code] of Object.entries(pageObjectsByType)) {
      const pageObjectPath = path.join(
        PAGE_OBJECTS_PATH,
        `generated${capitalize(pageName)}Page.ts`
      );
      writeFileSync(pageObjectPath, code, 'utf-8');
      const filename = `generated${capitalize(pageName)}Page.ts`;
      logger.logPageObjectGeneration(pageName, url, pageElements.length, filename);
    }
  }

  logger.info(`✅ Successfully generated all page objects for ${url}`, {
    section: 'PAGE_OBJECT_BUILD',
  });
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function detectPageType(htmlContent: string, url: string): string {
  const $ = require('cheerio').load(htmlContent);
  const content = htmlContent.toLowerCase();
  const title = $('title').text().toLowerCase();

  // Detect page types from content and URL
  if (
    content.includes('logged in') ||
    content.includes('logged-in') ||
    url.includes('logged-in') ||
    content.includes('dashboard')
  ) {
    return 'dashboard';
  }

  if (content.includes('error') && !content.includes('password')) {
    return 'error';
  }

  if (
    content.includes('login') ||
    content.includes('sign in') ||
    content.includes('username') ||
    content.includes('password')
  ) {
    return 'login';
  }

  return 'login'; // Default to login
}

function generatePageObjectsByType(
  elements: PageElement[],
  url: string,
  pageType: string
): { [key: string]: string } {
  const pageObjects: { [key: string]: string } = {};

  // Filter elements based on page type
  let filteredElements: PageElement[] = elements;

  if (pageType === 'login') {
    filteredElements = elements.filter(
      (el) =>
        !el.name.includes('success') &&
        !el.name.includes('dashboard') &&
        !el.description.includes('Success')
    );
  } else if (pageType === 'dashboard') {
    filteredElements = elements.filter(
      (el) =>
        el.name.includes('success') ||
        el.name.includes('text') ||
        el.name.includes('heading') ||
        el.description.includes('Success') ||
        el.description.includes('Heading')
    );
  } else if (pageType === 'error') {
    filteredElements = elements.filter(
      (el) => el.name.includes('error') || el.description.includes('Error')
    );
  }

  // Generate page object for the detected type
  const typeUrl =
    pageType === 'dashboard' ? url.replace(/\/$/, '') + '/logged-in-successfully/' : url;

  pageObjects[pageType] = generatePageObjectFile(filteredElements, typeUrl);

  return pageObjects;
}

async function identifyPageElements(url: string, htmlContent?: string): Promise<PageElement[]> {
  if (htmlContent) {
    try {
      logger.info('📄 Analyzing actual DOM from HTML...', { section: 'DOM_ANALYSIS' });
      const analysis = analyzeDOM(htmlContent);
      const elements: PageElement[] = [];

      if (analysis.inputFields.length > 0) {
        analysis.inputFields.forEach((field, idx) => {
          const name = field.name || `field${idx}`;
          elements.push({
            name: toCamelCase(`${name}_input`),
            selector: field.selector,
            description: field.label || field.placeholder || `Input field: ${name}`,
          });
        });
      }

      if (analysis.buttons.length > 0) {
        analysis.buttons.forEach((btn, idx) => {
          const name = btn.text || `button${idx}`;
          elements.push({
            name: toCamelCase(`${name}_button`),
            selector: btn.selector,
            description: btn.text || `Button element`,
          });
        });
      }

      if (analysis.links.length > 0) {
        analysis.links.forEach((link, idx) => {
          const name = link.text || `link${idx}`;
          elements.push({
            name: toCamelCase(`${name}_link`),
            selector: link.selector,
            description: `Link: ${link.text}`,
          });
        });
      }

      if (analysis.headings.length > 0) {
        analysis.headings.forEach((heading, idx) => {
          const name = heading.text || `heading${idx}`;
          elements.push({
            name: toCamelCase(`${name}_heading`),
            selector: heading.selector,
            description: `Heading (H${heading.level}): ${heading.text}`,
          });
        });
      }

      if (analysis.errorElements.length > 0) {
        analysis.errorElements.forEach((error, idx) => {
          const name = error.selector.replace(/[#.\[\]"=]/g, '') || `error${idx}`;
          elements.push({
            name: toCamelCase(`${name}_error`),
            selector: error.selector,
            description: error.description,
          });
        });
      }

      if (analysis.successElements.length > 0) {
        analysis.successElements.forEach((success, idx) => {
          const name = success.selector.replace(/[#.\[\]"=]/g, '') || `success${idx}`;
          elements.push({
            name: toCamelCase(`${name}_success`),
            selector: success.selector,
            description: success.description,
          });
        });
      }

      if (analysis.textElements && analysis.textElements.length > 0) {
        analysis.textElements.forEach((textEl, idx) => {
          const name = textEl.text
            .substring(0, 30)
            .replace(/[^a-zA-Z0-9\s]/g, ' ')
            .trim()
            .replace(/\s+/g, '_');
          if (name.length > 0) {
            elements.push({
              name: toCamelCase(`${name}_text`),
              selector: textEl.selector,
              description: `Text element: ${textEl.text.substring(0, 50)}`,
            });
          }
        });
      }

      if (elements.length > 0) {
        logger.logElementDiscovery('actual_dom', elements, { url, method: 'static_analysis' });
        return elements;
      }
    } catch (error) {
      logger.warn('Failed to analyze DOM:', {
        section: 'DOM_ANALYSIS',
        details: { error: error instanceof Error ? error.message : error },
      });
    }
  }

  logger.info('⚙️ Using WebdriverIO fallback...', { section: 'DOM_ANALYSIS' });
  return getDefaultElements(url);
}

async function getDefaultElements(url: string): Promise<PageElement[]> {
  try {
    const { remote } = await import('webdriverio');
    const browser = await remote({
      capabilities: { browserName: 'chrome' },
    });

    await browser.url(url);

    const elements = await browser.$$(
      [
        'input',
        'button',
        'a',
        'select',
        'textarea',
        '[role=button]',
        '[onclick]',
        '[data-testid]',
      ].join(',')
    );

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
        const identifier =
          id || name || testId || role || (classNames ? classNames.split(' ')[0] : '');
        let elementName = identifier
          ? toCamelCase(`${tagName}_${identifier}`)
          : toCamelCase(`${tagName}_element_${pageElements.length}`);

        // Ensure uniqueness by appending counter if needed
        let uniqueName = elementName;
        let counter = 1;
        while (pageElements.some((el) => el.name === uniqueName)) {
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
            return Array.from(el.attributes).reduce(
              (acc, attr) => {
                acc[attr.name] = attr.value;
                return acc;
              },
              {} as Record<string, string>
            );
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
          description: `${tagName} element${text ? ` with text "${text.substring(0, 20)}..."` : ''}`,
        });
      } catch (err: unknown) {
        if (err instanceof Error) {
          console.warn(`Couldn't analyze element: ${err.message}`);
        } else {
          console.warn("Couldn't analyze element due to unknown error");
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
        name: 'mainForm',
        selector: 'form',
        description: 'Main form on the page',
      },
      {
        name: 'primaryButton',
        selector: "button.primary, button[type='submit']",
        description: 'Primary action button',
      },
    ];
  }
}

function generatePageObjectFile(elements: PageElement[], url: string): string {
  // Deduplicate elements by name, keeping the first occurrence
  const uniqueElements = Array.from(new Map(elements.map((el) => [el.name, el])).values());

  const elementsCode = uniqueElements
    .map((el) => {
      return `  /**
   * ${el.description}
   */
  get ${el.name}() {
    return $('${el.selector.replace(/'/g, "\\'")}');
  }`;
    })
    .join('\n\n');

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
