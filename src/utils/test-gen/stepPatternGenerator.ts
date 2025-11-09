export interface StepPattern {
  pattern: string;
  examples: string[];
  description: string;
}

export class StepPatternGenerator {
  private commonPatterns: Map<string, StepPattern> = new Map();

  constructor() {
    this.initializePatterns();
  }

  private initializePatterns(): void {
    this.commonPatterns.set('navigation', {
      pattern: '^I navigate to "([^"]*)"$',
      examples: ['I navigate to "https://example.com"', 'I navigate to "/login"'],
      description: 'Navigate to a specific URL',
    });

    this.commonPatterns.set('wait', {
      pattern: '^I wait for (\\d+) (?:seconds?|ms)$',
      examples: ['I wait for 5 seconds', 'I wait for 2000 ms'],
      description: 'Wait for a specific duration',
    });

    this.commonPatterns.set('click', {
      pattern: '^I click on the "([^"]*)" (?:button|link|element)$',
      examples: ['I click on the "Submit" button', 'I click on the "Login" link'],
      description: 'Click on an element',
    });

    this.commonPatterns.set('enter-text', {
      pattern: '^I enter "([^"]*)" into the "([^"]*)" field$',
      examples: ['I enter "test@example.com" into the "email" field'],
      description: 'Enter text into a field',
    });

    this.commonPatterns.set('verify-visible', {
      pattern: '^the "([^"]*)" element should be visible$',
      examples: ['the "success message" element should be visible'],
      description: 'Verify element is visible',
    });

    this.commonPatterns.set('verify-text', {
      pattern: '^I should see "([^"]*)"$',
      examples: ['I should see "Welcome"'],
      description: 'Verify text is visible',
    });

    this.commonPatterns.set('verify-url', {
      pattern: '^the page url should contain "([^"]*)"$',
      examples: ['the page url should contain "/dashboard"'],
      description: 'Verify URL contains text',
    });

    this.commonPatterns.set('submit-form', {
      pattern: '^I submit the form(?: with (valid|invalid) data)?$',
      examples: ['I submit the form', 'I submit the form with valid data'],
      description: 'Submit a form',
    });

    this.commonPatterns.set('fill-form', {
      pattern: '^I fill the form with (valid|invalid) data$',
      examples: ['I fill the form with valid data', 'I fill the form with invalid data'],
      description: 'Fill form with predefined test data',
    });

    this.commonPatterns.set('error-message', {
      pattern: '^I should see an error message$',
      examples: ['I should see an error message'],
      description: 'Verify error message is displayed',
    });

    this.commonPatterns.set('page-title', {
      pattern: '^the page title should contain "([^"]*)"$',
      examples: ['the page title should contain "Login"'],
      description: 'Verify page title',
    });

    this.commonPatterns.set('field-required', {
      pattern: '^the "([^"]*)" field should be required$',
      examples: ['the "email" field should be required'],
      description: 'Verify field is required',
    });

    this.commonPatterns.set('clear-field', {
      pattern: '^I clear the "([^"]*)" field$',
      examples: ['I clear the "email" field'],
      description: 'Clear a form field',
    });

    this.commonPatterns.set('select-option', {
      pattern: '^I select "([^"]*)" from the "([^"]*)" dropdown$',
      examples: ['I select "Option 1" from the "country" dropdown'],
      description: 'Select option from dropdown',
    });

    this.commonPatterns.set('checkbox', {
      pattern: '^I (?:check|uncheck) the "([^"]*)" checkbox$',
      examples: ['I check the "Remember me" checkbox'],
      description: 'Check or uncheck a checkbox',
    });

    this.commonPatterns.set('radio', {
      pattern: '^I select the "([^"]*)" radio button$',
      examples: ['I select the "Male" radio button'],
      description: 'Select a radio button',
    });

    this.commonPatterns.set('find-element', {
      pattern: '^I should find (\\d+) "([^"]*)" elements?$',
      examples: ['I should find 3 "table rows" elements'],
      description: 'Verify number of elements',
    });

    this.commonPatterns.set('element-enabled', {
      pattern: '^the "([^"]*)" button should be enabled$',
      examples: ['the "Submit" button should be enabled'],
      description: 'Verify element is enabled',
    });

    this.commonPatterns.set('element-disabled', {
      pattern: '^the "([^"]*)" button should be disabled$',
      examples: ['the "Submit" button should be disabled'],
      description: 'Verify element is disabled',
    });

    this.commonPatterns.set('screenshot', {
      pattern: '^I take a screenshot(?:.*)?$',
      examples: ['I take a screenshot', 'I take a screenshot for "evidence"'],
      description: 'Take a screenshot',
    });

    this.commonPatterns.set('switch-window', {
      pattern: '^I switch to the (?:new|latest) window$',
      examples: ['I switch to the new window'],
      description: 'Switch to a different window',
    });

    this.commonPatterns.set('refresh-page', {
      pattern: '^I refresh the page$',
      examples: ['I refresh the page'],
      description: 'Refresh the page',
    });

    this.commonPatterns.set('click-button', {
      pattern: '^I click the "([^"]*)" button$',
      examples: [
        'I click the "back" button',
        'I click the "submit" button',
        'I click the "login" button',
      ],
      description: 'Click a button by name',
    });

    this.commonPatterns.set('hover', {
      pattern: '^I hover over the "([^"]*)"$',
      examples: ['I hover over the "menu"'],
      description: 'Hover over an element',
    });

    this.commonPatterns.set('scroll', {
      pattern: '^I scroll (?:to|into) the "([^"]*)" element$',
      examples: ['I scroll to the "footer" element'],
      description: 'Scroll to element',
    });

    this.commonPatterns.set('double-click', {
      pattern: '^I double(?:\\s|-)?click on the "([^"]*)"$',
      examples: ['I double-click on the "edit button"'],
      description: 'Double-click on element',
    });

    this.commonPatterns.set('right-click', {
      pattern: '^I right(?:\\s|-)?click on the "([^"]*)"$',
      examples: ['I right-click on the "menu"'],
      description: 'Right-click on element',
    });

    this.commonPatterns.set('enter-username-password', {
      pattern: '^I enter "([^"]*)" as my username and any password$',
      examples: ['I enter "invalid_username" as my username and any password'],
      description: 'Enter username and use default password',
    });

    this.commonPatterns.set('error-message-indicating', {
      pattern: '^I should see an error message indicating "([^"]*)"$',
      examples: ['I should see an error message indicating "Invalid username format"'],
      description: 'Verify specific error message',
    });

    this.commonPatterns.set('form-remains', {
      pattern: '^the form remains on the page$',
      examples: ['the form remains on the page'],
      description: 'Verify form is still visible',
    });

    this.commonPatterns.set('leave-fields-blank', {
      pattern: '^I leave both username and password fields blank$',
      examples: ['I leave both username and password fields blank'],
      description: 'Clear username and password fields',
    });

    this.commonPatterns.set('error-messages-missing-fields', {
      pattern: '^I should see error messages for missing username and password$',
      examples: ['I should see error messages for missing username and password'],
      description: 'Verify error messages for blank fields',
    });

    this.commonPatterns.set('page-loaded', {
      pattern: '^the page is loaded$',
      examples: ['the page is loaded'],
      description: 'Verify page has loaded',
    });

    this.commonPatterns.set('enter-valid-data', {
      pattern: '^I enter valid data into all fields$',
      examples: ['I enter valid data into all fields'],
      description: 'Enter valid test data into form fields',
    });

    this.commonPatterns.set('enter-invalid-data', {
      pattern: '^I enter invalid data into the fields$',
      examples: ['I enter invalid data into the fields'],
      description: 'Enter invalid test data into form fields',
    });

    this.commonPatterns.set('data-accepted', {
      pattern: '^the data should be accepted$',
      examples: ['the data should be accepted'],
      description: 'Verify data was accepted',
    });

    this.commonPatterns.set('data-not-accepted', {
      pattern: '^the data should not be accepted$',
      examples: ['the data should not be accepted'],
      description: 'Verify data was not accepted',
    });

    this.commonPatterns.set('see-confirmation', {
      pattern: '^I should see a confirmation message$',
      examples: ['I should see a confirmation message'],
      description: 'Verify confirmation message is visible',
    });

    this.commonPatterns.set('see-error-messages', {
      pattern: '^I should see error messages$',
      examples: ['I should see error messages'],
      description: 'Verify error messages are visible',
    });
  }

  generatePatternForStep(stepText: string): string {
    const normalizedStep = stepText.toLowerCase().trim();

    for (const [, pattern] of this.commonPatterns) {
      for (const example of pattern.examples) {
        const normalizedExample = example.toLowerCase().trim();

        if (normalizedStep === normalizedExample) {
          return pattern.pattern;
        }

        if (this.stepMatchesExample(stepText, example)) {
          return pattern.pattern;
        }
      }
    }

    return this.generateGenericPattern(stepText);
  }

  private stepMatchesExample(step: string, example: string): boolean {
    const normalizedStep = step.toLowerCase().trim();
    const normalizedExample = example.toLowerCase().trim();

    const stepWords = normalizedStep.split(/\s+/);
    const exampleWords = normalizedExample.split(/[\s"()]/g).filter((w) => w.length > 0);

    if (stepWords.length !== exampleWords.length) {
      return false;
    }

    let matches = 0;
    for (let i = 0; i < stepWords.length; i++) {
      const stepWord = stepWords[i];
      const exampleWord = exampleWords[i];

      if (
        stepWord.includes(exampleWord) ||
        exampleWord.includes(stepWord) ||
        stepWord === exampleWord
      ) {
        matches++;
      }
    }

    const similarity = matches / stepWords.length;
    return similarity > 0.7;
  }

  private generateGenericPattern(stepText: string): string {
    const parts: string[] = [];
    let remaining = stepText;

    const quotedRegex = /"[^"]*"/g;
    const numberRegex = /\b\d+\b/g;

    let lastIndex = 0;
    let match;

    const allMatches: Array<{
      start: number;
      end: number;
      type: 'quote' | 'number';
      original: string;
    }> = [];

    while ((match = quotedRegex.exec(stepText)) !== null) {
      allMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'quote',
        original: match[0],
      });
    }

    while ((match = numberRegex.exec(stepText)) !== null) {
      allMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'number',
        original: match[0],
      });
    }

    allMatches.sort((a, b) => a.start - b.start);

    lastIndex = 0;
    for (const m of allMatches) {
      const textBefore = stepText.substring(lastIndex, m.start);
      parts.push(this.escapeRegexChars(textBefore));

      if (m.type === 'quote') {
        parts.push('"([^"]*)"');
      } else if (m.type === 'number') {
        parts.push('(\\d+)');
      }

      lastIndex = m.end;
    }

    const textAfter = stepText.substring(lastIndex);
    parts.push(this.escapeRegexChars(textAfter));

    return `^${parts.join('')}$`;
  }

  private escapeRegexChars(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  extractParametersFromStep(stepText: string, patternKey: string): string[] {
    const pattern = this.commonPatterns.get(patternKey);
    if (!pattern) return [];

    const examples = pattern.examples;
    const matches = stepText.match(/["\']([^"\']*)["\']|(\d+)/g) || [];

    return matches.map((m) => m.replace(/["\'\s]/g, ''));
  }

  findBestMatchingPattern(stepText: string): StepPattern | null {
    let bestMatch: StepPattern | null = null;
    let highestScore = 0;

    for (const [, pattern] of this.commonPatterns) {
      for (const example of pattern.examples) {
        const score = this.calculateSimilarity(stepText, example);
        if (score > highestScore) {
          highestScore = score;
          bestMatch = pattern;
        }
      }
    }

    return highestScore > 0.5 ? bestMatch : null;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    const words1 = new Set(s1.split(/\W+/));
    const words2 = new Set(s2.split(/\W+/));

    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  getAllPatterns(): StepPattern[] {
    return Array.from(this.commonPatterns.values());
  }

  getPatternByKey(key: string): StepPattern | undefined {
    return this.commonPatterns.get(key);
  }
}

export const stepPatternGenerator = new StepPatternGenerator();
