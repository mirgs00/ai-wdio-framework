import { load } from 'cheerio';

export interface FormField {
  name: string;
  selector: string;
  type: string;
  required: boolean;
  placeholder?: string;
  label?: string;
  validation?: string;
  errorSelector?: string;
}

export interface FormInfo {
  selector: string;
  method: string;
  action: string;
  fields: FormField[];
  submit_button: {
    selector: string;
    text: string;
  } | null;
  validationPattern?: string;
}

export interface PageAnalysis {
  title: string;
  description: string;
  mainFunctionality: string;
  forms: FormInfo[];
  inputFields: FormField[];
  buttons: Array<{ selector: string; text: string; type: string }>;
  links: Array<{ selector: string; text: string; href: string }>;
  errorElements: Array<{ selector: string; description: string }>;
  successElements: Array<{ selector: string; description: string }>;
  tables: number;
  modals: number;
  suggestedScenarios: string[];
}

/**
 * Analyzes HTML content and extracts information about page structure.
 * Identifies forms, input fields, buttons, links, and other interactive elements.
 * 
 * @param html - The HTML content to analyze
 * @returns PageAnalysis object containing extracted page information
 * @throws Error if HTML parsing fails
 */
export function analyzeDOM(html: string): PageAnalysis {
  const $ = load(html);
  
  const title = $('title').text() || $('h1').first().text() || 'Unknown Page';
  const description = extractPageDescription($);
  
  const forms = extractForms($);
  const inputFields = extractInputFields($);
  const buttons = extractButtons($);
  const links = extractLinks($);
  const errorElements = extractErrorElements($);
  const successElements = extractSuccessElements($);
  
  const tables = $('table').length;
  const modals = $('[role="dialog"], .modal, [class*="modal"]').length;
  
  const mainFunctionality = inferMainFunctionality(forms, inputFields, buttons, title);
  const suggestedScenarios = generateSuggestedScenarios(
    forms,
    inputFields,
    buttons,
    mainFunctionality
  );
  
  return {
    title,
    description,
    mainFunctionality,
    forms,
    inputFields,
    buttons,
    links,
    errorElements,
    successElements,
    tables,
    modals,
    suggestedScenarios
  };
}

function extractPageDescription($: any): string {
  const metaDescription = $('meta[name="description"]').attr('content');
  if (metaDescription) return metaDescription;
  
  const h1Text = $('h1').first().text();
  if (h1Text) return h1Text;
  
  const paragraph = $('p').first().text();
  if (paragraph) return paragraph.substring(0, 150);
  
  return 'Web page';
}

function extractForms($: any): FormInfo[] {
  const forms: FormInfo[] = [];
  
  $('form').each((_: number, form: any) => {
    const $form = $(form);
    const selector = $form.attr('id') ? `#${$form.attr('id')}` : 'form';
    const method = ($form.attr('method') || 'POST').toUpperCase();
    const action = $form.attr('action') || '';
    
    const fields: FormField[] = [];
    $form.find('input, textarea, select').each((_: number, field: any) => {
      const $field = $(field);
      const type = $field.attr('type') || $field.prop('tagName').toLowerCase();
      const name = $field.attr('name') || $field.attr('id') || '';
      const id = $field.attr('id');
      const selector = id ? `#${id}` : name ? `[name="${name}"]` : '';
      
      if (selector) {
        const required = $field.prop('required') || $form.find(`label[for="${id}"]`).text().includes('*');
        const placeholder = $field.attr('placeholder');
        const label = $form.find(`label[for="${id}"]`).text().trim();
        
        const validation = inferFieldValidation($, field, type);
        const errorSelector = findErrorElementForField($, id);
        
        fields.push({
          name,
          selector,
          type,
          required,
          placeholder,
          label,
          validation,
          errorSelector
        });
      }
    });
    
    const submit_button = extractFormsubmit_button($, $form);
    const validationPattern = inferFormValidationPattern($form, fields);
    
    forms.push({
      selector,
      method,
      action,
      fields,
      submit_button,
      validationPattern
    });
  });
  
  return forms;
}

function extractInputFields($: any): FormField[] {
  const fields: FormField[] = [];
  const seen = new Set<string>();
  
  $('input, textarea, select').each((_: number, field: any) => {
    const $field = $(field);
    const type = $field.attr('type') || $field.prop('tagName').toLowerCase();
    const id = $field.attr('id');
    const name = $field.attr('name') || id || '';
    const selector = id ? `#${id}` : name ? `[name="${name}"]` : '';
    
    if (selector && !seen.has(selector)) {
      seen.add(selector);
      
      const required = $field.prop('required');
      const placeholder = $field.attr('placeholder');
      const label = $(`label[for="${id}"]`).text().trim();
      const validation = inferFieldValidation($, field, type);
      
      fields.push({
        name,
        selector,
        type,
        required,
        placeholder,
        label,
        validation
      });
    }
  });
  
  return fields;
}

function extractButtons($: any): Array<{ selector: string; text: string; type: string }> {
  const buttons: Array<{ selector: string; text: string; type: string }> = [];
  const seen = new Set<string>();
  
  $('button, input[type="submit"], input[type="button"], input[type="reset"]').each((_: number, btn: any) => {
    const $btn = $(btn);
    const id = $btn.attr('id');
    const text = $btn.text().trim() || $btn.attr('value') || $btn.attr('aria-label') || '';
    const type = $btn.attr('type') || 'button';
    const selector = id ? `#${id}` : text ? `button:contains("${text}")` : `button[type="${type}"]`;
    
    if (!seen.has(selector)) {
      seen.add(selector);
      buttons.push({ selector, text, type });
    }
  });
  
  return buttons;
}

function extractLinks($: any): Array<{ selector: string; text: string; href: string }> {
  const links: Array<{ selector: string; text: string; href: string }> = [];
  
  $('a[href]').each((_: number, link: any) => {
    const $link = $(link);
    const text = $link.text().trim();
    const href = $link.attr('href') || '';
    const id = $link.attr('id');
    const selector = id ? `#${id}` : text ? `a:contains("${text}")` : `a[href="${href}"]`;
    
    if (text.length > 0 && text.length < 100 && !href.startsWith('#')) {
      links.push({ selector, text, href });
    }
  });
  
  return links;
}

function extractErrorElements($: any): Array<{ selector: string; description: string }> {
  const errors: Array<{ selector: string; description: string }> = [];
  
  $('[class*="error"], [class*="error-message"], [role="alert"], .alert-danger').each((_: number, el: any) => {
    const $el = $(el);
    const id = $el.attr('id');
    const classes = $el.attr('class') || '';
    const selector = id ? `#${id}` : `.${classes.split(' ')[0]}`;
    const text = $el.text().trim().substring(0, 50);
    
    if (!errors.some(e => e.selector === selector)) {
      errors.push({ 
        selector, 
        description: `Error message: ${text || 'Generic error element'}` 
      });
    }
  });
  
  return errors;
}

function extractSuccessElements($: any): Array<{ selector: string; description: string }> {
  const success: Array<{ selector: string; description: string }> = [];
  
  $('[class*="success"], [class*="success-message"], .alert-success, [class*="confirmation"]').each((_: number, el: any) => {
    const $el = $(el);
    const id = $el.attr('id');
    const classes = $el.attr('class') || '';
    const selector = id ? `#${id}` : `.${classes.split(' ')[0]}`;
    const text = $el.text().trim().substring(0, 50);
    
    if (!success.some(s => s.selector === selector)) {
      success.push({ 
        selector, 
        description: `Success message: ${text || 'Generic success element'}` 
      });
    }
  });
  
  return success;
}

function inferFieldValidation($: any, field: any, type: string): string {
  const $field = $(field);
  const pattern = $field.attr('pattern');
  const minLength = $field.attr('minlength');
  const maxLength = $field.attr('maxlength');
  const min = $field.attr('min');
  const max = $field.attr('max');
  
  const validations = [];
  if (pattern) validations.push(`pattern: ${pattern}`);
  if (minLength) validations.push(`min: ${minLength} chars`);
  if (maxLength) validations.push(`max: ${maxLength} chars`);
  if (min) validations.push(`min value: ${min}`);
  if (max) validations.push(`max value: ${max}`);
  
  if (type === 'email') validations.push('email format');
  if (type === 'password') validations.push('password field');
  if (type === 'url') validations.push('URL format');
  if (type === 'number') validations.push('numeric only');
  
  return validations.join(', ') || 'none';
}

function inferFormValidationPattern($form: any, fields: FormField[]): string {
  const patterns = [];
  
  for (const field of fields) {
    if (field.validation && field.validation !== 'none') {
      patterns.push(`${field.name || 'field'}: ${field.validation}`);
    }
  }
  
  if (patterns.length > 0) {
    return patterns.join('; ');
  }
  
  return 'Basic form validation';
}

function findErrorElementForField($: any, fieldId: string): string | undefined {
  if (!fieldId) return undefined;
  
  const $field = $(`#${fieldId}`);
  const $parent = $field.parent();
  
  let errorEl = $parent.find('[class*="error"]').first();
  if (errorEl.length > 0) {
    const id = errorEl.attr('id');
    return id ? `#${id}` : undefined;
  }
  
  errorEl = $parent.find('[role="alert"]').first();
  if (errorEl.length > 0) {
    const id = errorEl.attr('id');
    return id ? `#${id}` : undefined;
  }
  
  return undefined;
}

function extractFormsubmit_button($: any, $form: any) {
  const submitBtn = $form.find('button[type="submit"], input[type="submit"]').first();
  
  if (submitBtn.length > 0) {
    const id = submitBtn.attr('id');
    const text = submitBtn.text().trim() || submitBtn.attr('value') || 'Submit';
    const selector = id ? `#${id}` : `button[type="submit"]`;
    
    return { selector, text };
  }
  
  return null;
}

function inferMainFunctionality(
  forms: FormInfo[],
  inputFields: FormField[],
  buttons: Array<any>,
  title: string
): string {
  if (forms.length > 0) {
    const firstForm = forms[0];
    const fieldTypes = firstForm.fields.map(f => f.type).join(', ');
    
    if (fieldTypes.includes('email') || fieldTypes.includes('password')) {
      return 'User authentication (login/registration)';
    }
    
    if (firstForm.fields.length > 3) {
      return 'Complex form submission';
    }
    
    return 'Form submission';
  }
  
  if (inputFields.length > 0) {
    return 'Data input and processing';
  }
  
  if (buttons.length > 0) {
    return 'Interactive page with user actions';
  }
  
  if (title.toLowerCase().includes('login') || title.toLowerCase().includes('sign in')) {
    return 'Login page';
  }
  
  if (title.toLowerCase().includes('register') || title.toLowerCase().includes('sign up')) {
    return 'Registration page';
  }
  
  return 'General web page';
}

function generateSuggestedScenarios(
  forms: FormInfo[],
  inputFields: FormField[],
  buttons: Array<any>,
  mainFunctionality: string
): string[] {
  const scenarios: string[] = [];
  
  if (mainFunctionality.includes('authentication')) {
    scenarios.push('Test login with valid credentials');
    scenarios.push('Test login with invalid email format');
    scenarios.push('Test login with empty fields');
    scenarios.push('Test login with incorrect password');
    scenarios.push('Test remember me functionality');
  }
  
  if (forms.length > 0) {
    const form = forms[0];
    const requiredFields = form.fields.filter(f => f.required);
    
    if (requiredFields.length > 0) {
      scenarios.push(`Test form submission with missing required fields`);
      scenarios.push(`Test form validation errors`);
    }
    
    scenarios.push(`Test successful form submission`);
    scenarios.push(`Test form reset`);
  }
  
  if (inputFields.some(f => f.type === 'email')) {
    scenarios.push('Test email validation');
    scenarios.push('Test invalid email format');
  }
  
  if (inputFields.some(f => f.type === 'password')) {
    scenarios.push('Test password field masking');
    scenarios.push('Test password requirements');
  }
  
  if (buttons.some(b => b.text.toLowerCase().includes('reset'))) {
    scenarios.push('Test form reset functionality');
  }
  
  if (buttons.some(b => b.text.toLowerCase().includes('cancel'))) {
    scenarios.push('Test cancel operation');
  }
  
  return Array.from(new Set(scenarios)).slice(0, 10);
}
