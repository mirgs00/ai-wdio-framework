import { PageAnalysis } from '../dom/domAnalyzer';

export type ScenarioType = 'happy-path' | 'negative' | 'edge-case' | 'validation' | 'workflow';

export interface PromptTemplate {
  type: ScenarioType;
  title: string;
  description: string;
  generatePrompt(analysis: PageAnalysis, userInstruction: string): string;
}

class HappyPathTemplate implements PromptTemplate {
  type: ScenarioType = 'happy-path';
  title = 'Happy Path Scenarios';
  description = 'Successful completion scenarios with valid data';

  generatePrompt(analysis: PageAnalysis, userInstruction: string): string {
    const formInfo = analysis.forms.length > 0 
      ? `\nForm fields: ${analysis.forms[0].fields.map(f => f.label || f.name).join(', ')}`
      : '';
    
    const buttons = analysis.buttons.map(b => b.text.toLowerCase()).filter(Boolean).slice(0, 3).join(', ');
    const buttonExamples = buttons ? `Available buttons: ${buttons}. Use format: 'And I click the "buttonname" button'` : 'For button clicks use format: "And I click the "buttonname" button"';
    
    return `Generate a happy path Cucumber scenario for: "${userInstruction}"

Application: ${analysis.mainFunctionality}
${formInfo}

Requirements:
1. User successfully completes the main action with valid, realistic data
2. Fill ALL required form fields with appropriate valid values
3. Include ALL necessary steps: enter valid data for each field, submit/click button, verify success
4. Verify successful completion (look for success message, confirmation, or page change)
5. Keep scenario focused and realistic - one complete workflow
6. Do not add unnecessary assertions or steps

IMPORTANT:
- For login: Use credentials that would realistically succeed
- Verify the actual successful outcome (not made-up states)
- Step count: 4-6 steps total

Button click format (IMPORTANT):
${buttonExamples}

Format as valid Gherkin only, no commentary or explanations:
@happy-path @positive
Scenario: [Descriptive name]
  Given [precondition]
  When [user enters valid data for all required fields]
  And I click the "submit" button
  Then [realistic successful outcome]`;
  }
}

class NegativeTestTemplate implements PromptTemplate {
  type: ScenarioType = 'negative';
  title = 'Negative Test Scenarios';
  description = 'Invalid input and error handling scenarios';

  generatePrompt(analysis: PageAnalysis, userInstruction: string): string {
    const validationInfo = analysis.forms.length > 0
      ? `Field validations: ${analysis.forms[0].validationPattern}`
      : '';

    const errorElements = analysis.errorElements.length > 0
      ? `Error elements available: ${analysis.errorElements.map(e => e.description).join(', ')}`
      : '';

    const buttons = analysis.buttons.map(b => b.text.toLowerCase()).filter(Boolean).slice(0, 3).join(', ');
    const buttonExamples = buttons ? `Available buttons: ${buttons}. Use format: 'And I click the "buttonname" button'` : 'For button clicks use format: "And I click the "buttonname" button"';

    return `Generate negative test Cucumber scenarios for: "${userInstruction}"

Application: ${analysis.mainFunctionality}
${validationInfo}
${errorElements}

Focus on REALISTIC error conditions that the application actually checks:
1. Invalid input formats (only if the form validates format)
2. Missing required fields
3. Out-of-range values (if applicable)
4. Credential mismatches (wrong password, non-existent user)
5. Boundary conditions for length constraints

Generate 2 scenarios covering the most important, REALISTIC error cases that the application will actually catch.

Requirements:
- Include ALL necessary steps: enter complete data, click submit/button, verify error
- Each scenario tests ONE coherent error condition
- Use realistic invalid test data that the application would reject
- Ensure error messages match what the application actually displays
- Form should remain on page or display error - don't make up unrealistic outcomes

Button click format (IMPORTANT):
${buttonExamples}

Format as valid Gherkin only, no commentary or explanations:
@negative @validation @error
Scenario: [Error scenario name]
  Given [precondition]
  When [user enters invalid data for one or more fields]
  And I click the "submit" button
  Then [realistic error message shown]
  And [form remains on page or error displayed]`;
  }
}

class EdgeCaseTemplate implements PromptTemplate {
  type: ScenarioType = 'edge-case';
  title = 'Edge Case Scenarios';
  description = 'Boundary conditions and special cases';

  generatePrompt(analysis: PageAnalysis, userInstruction: string): string {
    const fields = analysis.inputFields.filter(f => f.validation && f.validation !== 'none');
    const fieldConstraints = fields.length > 0
      ? `Constraints: ${fields.map(f => `${f.name} (${f.validation})`).join(', ')}`
      : '';

    return `Generate edge case Cucumber scenarios for: "${userInstruction}"

Application: ${analysis.mainFunctionality}
${fieldConstraints}

Edge cases to consider (only if they are RELEVANT to the form):
1. Minimum/maximum field lengths (if length constraints exist)
2. Whitespace-only values (spaces only)
3. Leading/trailing spaces with valid data
4. Boundary values for length (e.g., exactly minimum, exactly maximum length)
5. Real-world edge cases relevant to the form type

IMPORTANT:
- Only test edge cases that are RELEVANT to the actual form fields
- For login forms: test boundary lengths for username/password, whitespace handling
- Generate only 1-2 realistic edge case scenarios, not arbitrary ones
- Each scenario should be a complete workflow that tests ONE edge case

Format as valid Gherkin only, no commentary or explanations:
@edge-case
Scenario: [Edge case name]
  Given [specific precondition]
  When [edge case input that tests boundary/special condition]
  And I click the "submit" button
  Then [appropriate behavior for this edge case]`;
  }
}

class ValidationTestTemplate implements PromptTemplate {
  type: ScenarioType = 'validation';
  title = 'Validation Test Scenarios';
  description = 'Input validation and constraint testing';

  generatePrompt(analysis: PageAnalysis, userInstruction: string): string {
    const requiredFields = analysis.inputFields.filter(f => f.required);
    const emailFields = analysis.inputFields.filter(f => f.type === 'email');
    const passwordFields = analysis.inputFields.filter(f => f.type === 'password');
    const numberFields = analysis.inputFields.filter(f => f.type === 'number');

    const validationChecks = [
      requiredFields.length > 0 ? `Required fields: ${requiredFields.map(f => f.label || f.name).join(', ')}` : '',
      emailFields.length > 0 ? 'Email format validation' : '',
      passwordFields.length > 0 ? 'Password requirements/strength' : '',
      numberFields.length > 0 ? 'Number format validation' : '',
      analysis.forms[0]?.validationPattern ? `Custom validation: ${analysis.forms[0].validationPattern}` : ''
    ].filter(Boolean).join('\n');

    const fieldList = analysis.inputFields.map(f => f.label || f.name).join(', ');
    const existingFieldsConstraint = fieldList ? `\nONLY test validation for these actual form fields: ${fieldList}` : '\nONLY test validation for fields that actually exist on the form.';

    const buttons = analysis.buttons.map(b => b.text.toLowerCase()).filter(Boolean).slice(0, 3).join(', ');
    const buttonExamples = buttons ? `Available buttons: ${buttons}. Use format: 'And I click the "buttonname" button'` : 'For button clicks use format: "And I click the "buttonname" button"';

    return `Generate validation test Cucumber scenarios for: "${userInstruction}"

${validationChecks}
${existingFieldsConstraint}

IMPORTANT - Create COHERENT scenarios that test ONE validation rule at a time:
1. When testing a field, fill OTHER required fields with valid data first
2. Only leave the field under test with invalid/empty data
3. Each scenario should be a complete, realistic workflow
4. Use realistic example values (e.g., valid email format like "user@domain.com", valid usernames)

For login forms specifically:
- When testing username validation: fill username with test data, fill password with valid data
- When testing password validation: fill username with valid data, leave or fill password with test data

Generate 2-3 validation scenarios based on the actual fields present.

Requirements:
- Include ALL necessary steps: fill ALL form fields appropriately, click submit, verify validation
- Test only fields that exist on the page
- Ensure each scenario is a complete, valid workflow except for ONE field under test

Button click format (IMPORTANT):
${buttonExamples}

Format as valid Gherkin only, no commentary or explanations:
@validation @positive
Scenario: [Validation test name]
  Given [setup state]
  When [fill valid data for other fields]
  And [test the specific field with invalid/empty data]
  And I click the "submit" button
  Then [expected validation error]`;
  }
}

class WorkflowTemplate implements PromptTemplate {
  type: ScenarioType = 'workflow';
  title = 'User Workflow Scenarios';
  description = 'Multi-step user journeys and workflows';

  generatePrompt(analysis: PageAnalysis, userInstruction: string): string {
    const buttons = analysis.buttons
      .filter(b => !b.text.toLowerCase().includes('submit'))
      .slice(0, 3);
    
    const buttonInfo = buttons.length > 0
      ? `Available actions: ${buttons.map(b => b.text).join(', ')}`
      : '';

    const links = analysis.links.slice(0, 3);
    const linkInfo = links.length > 0
      ? `Navigation options: ${links.map(l => l.text).join(', ')}`
      : '';

    return `Generate a complete user workflow Cucumber scenario for: "${userInstruction}"

Application: ${analysis.mainFunctionality}
${buttonInfo}
${linkInfo}

Create a scenario that includes:
1. Initial state/navigation
2. Multiple user interactions
3. Decision points or alternate flows
4. Final state verification
5. At least 6-8 steps

This should represent a realistic user journey through the application.

Format as valid Gherkin only, no commentary or explanations:
@workflow @integration
Scenario: [Complete user workflow]
  Given [initial state]
  When [first user action]
  And [subsequent actions]
  Then [final outcome]
  And [side effects verified]`;
  }
}

export class PromptTemplateManager {
  private templates: Map<ScenarioType, PromptTemplate>;

  constructor() {
    this.templates = new Map([
      ['happy-path', new HappyPathTemplate()],
      ['negative', new NegativeTestTemplate()],
      ['edge-case', new EdgeCaseTemplate()],
      ['validation', new ValidationTestTemplate()],
      ['workflow', new WorkflowTemplate()]
    ]);
  }

  getTemplate(type: ScenarioType): PromptTemplate {
    return this.templates.get(type) || this.templates.get('happy-path')!;
  }

  getAllTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  generatePromptForType(type: ScenarioType, analysis: PageAnalysis, instruction: string): string {
    const template = this.getTemplate(type);
    return template.generatePrompt(analysis, instruction);
  }

  generateMultipleScenarioPrompts(analysis: PageAnalysis, instruction: string): Map<ScenarioType, string> {
    const prompts = new Map<ScenarioType, string>();
    
    for (const [type, template] of this.templates) {
      prompts.set(type, template.generatePrompt(analysis, instruction));
    }
    
    return prompts;
  }

  /**
   * Generates an enhanced prompt for stable selector generation
   * Guides step definitions to use multi-selector patterns with fallbacks
   */
  generateStableSelectorPrompt(analysis: PageAnalysis, stepDescription: string): string {
    return `You are helping generate WebdriverIO step definitions with STABLE, RESILIENT selectors.

IMPORTANT SELECTOR GUIDELINES:
1. Use MULTI-SELECTOR patterns: 'selector1, selector2, selector3'
2. Primary selector should be the most specific and reliable
3. Add fallback selectors for common patterns:
   - ID-based: #element-id
   - Class-based: [class*="classname"]
   - Text-based: button:has-text("Button Text")
   - Role-based: [role="button"]
4. For buttons: Include multiple patterns like button type, class contains, and text
5. For inputs: Include id, name attribute, and type-based matching
6. For success/error messages: Include class patterns, IDs, and role attributes

EXAMPLE - Login Button Selector:
Good:   '#loginBtn, button[class*="login"], button:has-text("Login"), [role="button"][type="submit"]'
Bad:    'button' or ':nth-child(3) > button'

EXAMPLE - Success Message Selector:
Good:   '[class*="success"], #success, [id*="alert"], .alert-success, [role="status"]'
Bad:    '.message' or 'div:nth-of-type(2)'

Step: "${stepDescription}"
Elements available in page:
- Input fields: ${analysis.inputFields.map(f => f.name).join(', ')}
- Buttons: ${analysis.buttons.map(b => b.text).join(', ')}
- Success elements: ${analysis.successElements.map(e => e.description).join(', ')}
- Error elements: ${analysis.errorElements.map(e => e.description).join(', ')}

Generate a step definition that:
1. Uses the most robust multi-selector pattern
2. Includes 3-4 fallback selectors
3. Has clear comments explaining selector choices
4. Includes validation before interaction
5. Provides helpful error messages if selectors fail`;
  }
}

export const promptTemplateManager = new PromptTemplateManager();
