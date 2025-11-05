import * as cheerio from 'cheerio';

export interface DiscoveredElement {
  tag: string;
  id?: string;
  name?: string;
  type?: string;
  text?: string;
  selector: string;
  placeholder?: string;
  ariaLabel?: string;
  role?: string;
}

/**
 * Parses HTML and extracts useful UI elements for testing.
 * Discovers interactive elements like inputs, buttons, links, and custom components.
 * 
 * @param html - The HTML content to parse
 * @returns Array of discovered elements with selectors and metadata
 */
export function discoverElementsFromDOM(html: string): DiscoveredElement[] {
  const $ = cheerio.load(html);
  const elements: DiscoveredElement[] = [];

  const selectors = [
    'input', 'button', 'a', 'select', 'textarea',
    '[role="button"]', '[role="link"]', '[role="textbox"]',
    '[contenteditable]', '[aria-label]', '[data-testid]'
  ];

  $(selectors.join(',')).each((_, el) => {
    // Skip if not a tag node (text, comment, etc.)
    if (!('tagName' in el)) return;

    const tag = (el as any).tagName ?? 'unknown'; // safely extract tagName
    const $el = $(el);

    const id = $el.attr('id');
    const name = $el.attr('name');
    const type = $el.attr('type');
    const text = $el.text().trim();
    const placeholder = $el.attr('placeholder');
    const ariaLabel = $el.attr('aria-label');
    const role = $el.attr('role');

    let selector = '';

    if (id) {
      selector = `#${id}`;
    } else if (name) {
      selector = `${tag}[name="${name}"]`;
    } else if (ariaLabel) {
      selector = `${tag}[aria-label="${ariaLabel}"]`;
    } else if ($el.attr('data-testid')) {
      selector = `[data-testid="${$el.attr('data-testid')}"]`;
    } else if (text && text.length < 30) {
      selector = `${tag}:contains("${text}")`;
    } else {
      selector = tag;
    }

    elements.push({
      tag,
      id,
      name,
      type,
      text,
      selector,
      placeholder,
      ariaLabel,
      role
    });
  });

  return elements;
}
