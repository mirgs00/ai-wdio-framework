import { FormField, FormInfo } from '../dom/domAnalyzer';

export interface TestDataSet {
  valid: Record<string, any>;
  invalid: Record<string, any>;
  boundary: Record<string, any>;
  empty: Record<string, any>;
}

export class TestDataGenerator {
  private commonPasswords = ['Pass@123', 'Test123!', 'Secure@Pass123'];
  private commonUsernames = ['testuser', 'automation', 'qatester'];
  private commonEmails = ['test@example.com', 'qa@automation.com', 'user@test.com'];
  private invalidEmails = ['invalid.email', 'test@', '@example.com', 'test @example.com'];
  private shortPasswords = ['Pass1', 'Pwd123', 'Sec1'];
  private specialCharacters = ['!@#$%^&*()', '<script>alert(1)</script>', '"; DROP TABLE users; --'];

  generateTestDataForForm(form: FormInfo): TestDataSet {
    const testData: TestDataSet = {
      valid: {},
      invalid: {},
      boundary: {},
      empty: {}
    };

    for (const field of form.fields) {
      testData.valid[field.name] = this.generateValidData(field);
      testData.invalid[field.name] = this.generateInvalidData(field);
      testData.boundary[field.name] = this.generateBoundaryData(field);
      testData.empty[field.name] = this.generateEmptyData(field);
    }

    return testData;
  }

  private generateValidData(field: FormField): string {
    const type = field.type.toLowerCase();

    if (type === 'email') {
      return this.commonEmails[Math.floor(Math.random() * this.commonEmails.length)];
    }

    if (type === 'password') {
      return this.commonPasswords[Math.floor(Math.random() * this.commonPasswords.length)];
    }

    if (type === 'number') {
      return '42';
    }

    if (type === 'tel' || type === 'phone') {
      return '+1-555-0123';
    }

    if (type === 'url') {
      return 'https://example.com';
    }

    if (type === 'date') {
      const date = new Date();
      return date.toISOString().split('T')[0];
    }

    if (type === 'checkbox') {
      return 'true';
    }

    if (type === 'radio' || type === 'select') {
      return 'option1';
    }

    if (type === 'textarea') {
      return `This is a valid ${field.label || field.name} entry with appropriate content.`;
    }

    return field.placeholder 
      ? field.placeholder.replace(/[*:]/g, '') 
      : this.generateRandomString(10, true);
  }

  private generateInvalidData(field: FormField): string {
    const type = field.type.toLowerCase();

    if (type === 'email') {
      return this.invalidEmails[Math.floor(Math.random() * this.invalidEmails.length)];
    }

    if (type === 'password') {
      return this.shortPasswords[Math.floor(Math.random() * this.shortPasswords.length)];
    }

    if (type === 'number') {
      return 'not-a-number';
    }

    if (type === 'tel' || type === 'phone') {
      return 'invalid-phone';
    }

    if (type === 'url') {
      return 'not a url';
    }

    if (type === 'date') {
      return '99/99/9999';
    }

    return this.specialCharacters[Math.floor(Math.random() * this.specialCharacters.length)];
  }

  private generateBoundaryData(field: FormField): string {
    const type = field.type.toLowerCase();

    if (type === 'email') {
      return 'a@b.co';
    }

    if (type === 'password') {
      return 'P1';
    }

    if (type === 'number') {
      return '0';
    }

    if (type === 'tel' || type === 'phone') {
      return '1';
    }

    if (type === 'textarea') {
      return 'x';
    }

    return this.generateRandomString(255);
  }

  private generateEmptyData(field: FormField): string {
    const type = field.type.toLowerCase();

    if (type === 'checkbox' || type === 'radio') {
      return 'false';
    }

    return '';
  }

  generateTestDataForFields(fields: FormField[]): TestDataSet {
    const testData: TestDataSet = {
      valid: {},
      invalid: {},
      boundary: {},
      empty: {}
    };

    for (const field of fields) {
      testData.valid[field.name || field.selector] = this.generateValidData(field);
      testData.invalid[field.name || field.selector] = this.generateInvalidData(field);
      testData.boundary[field.name || field.selector] = this.generateBoundaryData(field);
      testData.empty[field.name || field.selector] = this.generateEmptyData(field);
    }

    return testData;
  }

  getValidCredentials(): { username: string; password: string } {
    return {
      username: this.commonEmails[0],
      password: this.commonPasswords[0]
    };
  }

  getInvalidCredentials(): { username: string; password: string } {
    return {
      username: this.invalidEmails[0],
      password: this.shortPasswords[0]
    };
  }

  getValidTestUser(): Record<string, string> {
    return {
      email: this.commonEmails[0],
      password: this.commonPasswords[0],
      username: this.commonUsernames[0],
      fullName: 'Test User',
      phone: '+1-555-0123'
    };
  }

  getInvalidTestUser(): Record<string, string> {
    return {
      email: this.invalidEmails[0],
      password: this.shortPasswords[0],
      username: 'a',
      fullName: this.specialCharacters[0],
      phone: 'invalid'
    };
  }

  private generateRandomString(length: number, alphanumeric: boolean = false): string {
    const chars = alphanumeric
      ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
      : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  formatDataForDisplay(data: Record<string, any>): string {
    return Object.entries(data)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  }
}

export const testDataGenerator = new TestDataGenerator();
