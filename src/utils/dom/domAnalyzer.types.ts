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
  submit_button: { selector: string; text: string } | null;
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
  headings: Array<{ selector: string; level: number; text: string }>;
  errorElements: Array<{ selector: string; description: string }>;
  successElements: Array<{ selector: string; description: string }>;
  textElements: Array<{ selector: string; text: string; tag: string }>;
  tables: number;
  modals: number;
  suggestedScenarios: string[];
}

export interface ButtonInfo {
  selector: string;
  text: string;
  type: string;
}

export interface LinkInfo {
  selector: string;
  text: string;
  href: string;
}

export interface HeadingInfo {
  selector: string;
  level: number;
  text: string;
}

export interface ErrorElementInfo {
  selector: string;
  description: string;
}

export interface SuccessElementInfo {
  selector: string;
  description: string;
}

export interface TextElementInfo {
  selector: string;
  text: string;
  tag: string;
}
