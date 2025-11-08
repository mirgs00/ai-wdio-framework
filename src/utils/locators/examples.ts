/**
 * Smart Locators - Usage Examples
 * This file demonstrates practical usage of Smart Locators in various scenarios
 */

import SmartPageObject from './smartPageObject';
import LocatorHelper from './locatorHelper';
import { browser } from '@wdio/globals';

// ============================================================================
// Example 1: Simple Element Finding
// ============================================================================

export async function example1_basicElementFinding() {
  console.log('Example 1: Basic Element Finding');

  // Find and click a button by text
  await LocatorHelper.click({ text: 'Submit' });

  // Find input and enter text
  await LocatorHelper.setValue({ placeholder: 'Email' }, 'test@example.com');

  // Get text from element
  const message = await LocatorHelper.getText({ role: 'alert' });
  console.log(`Alert message: ${message}`);

  // Check if element exists
  const exists = await LocatorHelper.exists({ ariaLabel: 'Close' });
  console.log(`Close button exists: ${exists}`);
}

// ============================================================================
// Example 2: Page Object with Smart Locators
// ============================================================================

class LoginPageExample extends SmartPageObject {
  constructor() {
    super('Login Page', 'https://example.com/login');

    // Register commonly used elements
    this.registerElement('username', { placeholder: 'Username' });
    this.registerElement('password', { placeholder: 'Password' });
    this.registerElement('submit', { text: 'Login' });
    this.registerElement('rememberMe', { ariaLabel: 'Remember me' });
  }

  async fillUsername(username: string): Promise<void> {
    await this.smartSetValue({ placeholder: 'Username' }, username);
  }

  async fillPassword(password: string): Promise<void> {
    await this.smartSetValue({ placeholder: 'Password' }, password);
  }

  async clickRememberMe(): Promise<void> {
    await this.smartClick({ role: 'checkbox', ariaLabel: 'Remember me' });
  }

  async submit(): Promise<void> {
    await this.smartClick({ text: 'Login' });
  }

  async getErrorMessage(): Promise<string | null> {
    try {
      return await this.smartGetText({ role: 'alert' });
    } catch {
      return null;
    }
  }

  async isErrorMessageVisible(): Promise<boolean> {
    return this.smartIsVisible({ role: 'alert' });
  }

  async login(username: string, password: string, remember: boolean = false): Promise<void> {
    await this.open();
    await this.fillUsername(username);
    await this.fillPassword(password);
    if (remember) {
      await this.clickRememberMe();
    }
    await this.submit();
  }
}

export async function example2_pageObject() {
  console.log('Example 2: Page Object with Smart Locators');

  const loginPage = new LoginPageExample();

  // Login with credentials
  await loginPage.login('john@example.com', 'SecurePass123', true);

  // Check for error
  const hasError = await loginPage.isErrorMessageVisible();
  if (hasError) {
    const errorMsg = await loginPage.getErrorMessage();
    console.log(`Error: ${errorMsg}`);
  }
}

// ============================================================================
// Example 3: Form Filling
// ============================================================================

class RegistrationPageExample extends SmartPageObject {
  constructor() {
    super('Registration', 'https://example.com/register');
  }

  async fillRegistrationForm(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    country: string;
  }): Promise<void> {
    await this.fillForm([
      { description: { placeholder: 'First Name' }, value: data.firstName },
      { description: { placeholder: 'Last Name' }, value: data.lastName },
      { description: { placeholder: 'Email Address' }, value: data.email },
      { description: { placeholder: 'Password' }, value: data.password },
      { description: { ariaLabel: 'Country' }, value: data.country },
    ]);
  }

  async submitForm(): Promise<void> {
    await this.smartClick({ text: 'Register' });
  }
}

export async function example3_formFilling() {
  console.log('Example 3: Form Filling');

  const registrationPage = new RegistrationPageExample();
  await registrationPage.open();

  await registrationPage.fillRegistrationForm({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    password: 'SecurePass123',
    country: 'United States',
  });

  await registrationPage.submitForm();
}

// ============================================================================
// Example 4: Retry Logic
// ============================================================================

export async function example4_retryLogic() {
  console.log('Example 4: Retry Logic');

  // Simple retry pattern
  const result = await LocatorHelper.withRetry(
    async () => {
      await LocatorHelper.click({ text: 'Save' });
      console.log('Clicked Save button');
      return true;
    },
    3, // max retries
    500 // delay in ms
  );

  console.log(`Result: ${result}`);
}

// ============================================================================
// Example 5: Wait for Text
// ============================================================================

export async function example5_waitForText() {
  console.log('Example 5: Wait for Text');

  // Wait for success message
  try {
    await LocatorHelper.waitForText({ role: 'status' }, 'Successfully saved', 10000);
    console.log('Success message appeared');
  } catch (e) {
    console.log('Success message did not appear');
  }

  // Check if element contains text
  const hasText = await LocatorHelper.textContains({ role: 'alert' }, 'error');
  console.log(`Alert contains 'error': ${hasText}`);
}

// ============================================================================
// Example 6: Verification Methods
// ============================================================================

class DashboardPageExample extends SmartPageObject {
  constructor() {
    super('Dashboard', 'https://example.com/dashboard');
  }

  async verifyDashboardLoaded(): Promise<boolean> {
    return this.verifyElementVisible({ text: 'Welcome' });
  }

  async verifyNoErrorMessage(): Promise<boolean> {
    return this.verifyElementNotVisible({ role: 'alert' });
  }

  async verifyUserGreeting(username: string): Promise<boolean> {
    return this.verifyText({ role: 'heading' }, `Welcome, ${username}`);
  }

  async checkTableVisible(): Promise<boolean> {
    return this.smartIsVisible({ role: 'table' });
  }
}

export async function example6_verification() {
  console.log('Example 6: Verification Methods');

  const dashboard = new DashboardPageExample();
  await dashboard.open();

  const isLoaded = await dashboard.verifyDashboardLoaded();
  console.log(`Dashboard loaded: ${isLoaded}`);

  const noErrors = await dashboard.verifyNoErrorMessage();
  console.log(`No error messages: ${noErrors}`);

  const welcomeText = await dashboard.verifyUserGreeting('John');
  console.log(`User greeting verified: ${welcomeText}`);
}

// ============================================================================
// Example 7: Action and Verify Pattern
// ============================================================================

class TodoAppPageExample extends SmartPageObject {
  constructor() {
    super('Todo App', 'https://example.com/todos');
  }

  async addTodoWithVerification(todoText: string): Promise<boolean> {
    return this.actionAndVerify(
      async () => {
        // Action: Add todo
        await this.smartSetValue({ placeholder: 'New todo' }, todoText);
        await this.smartClick({ text: 'Add' });
      },
      async () => {
        // Verify: Todo appears in list
        return this.smartTextContains({ role: 'list' }, todoText);
      },
      3 // retries
    );
  }

  async deleteTodoWithVerification(todoText: string): Promise<boolean> {
    return this.actionAndVerify(
      async () => {
        // Find todo item and click delete
        const todoItems = await browser.$$('xpath=//*[contains(text(), "' + todoText + '")]/../button');
        if (todoItems.length > 0) {
          await todoItems[0].click();
        }
      },
      async () => {
        // Verify: Todo is gone
        return !(await this.smartTextContains({ role: 'list' }, todoText));
      },
      2 // retries
    );
  }
}

export async function example7_actionAndVerify() {
  console.log('Example 7: Action and Verify Pattern');

  const todoApp = new TodoAppPageExample();
  await todoApp.open();

  const addSuccess = await todoApp.addTodoWithVerification('Buy groceries');
  console.log(`Add todo verification: ${addSuccess}`);

  const deleteSuccess = await todoApp.deleteTodoWithVerification('Buy groceries');
  console.log(`Delete todo verification: ${deleteSuccess}`);
}

// ============================================================================
// Example 8: Multiple Element Operations
// ============================================================================

export async function example8_multipleElements() {
  console.log('Example 8: Multiple Element Operations');

  // Fill multiple fields in sequence
  const fields = [
    { description: { placeholder: 'Name' }, value: 'John Doe' },
    { description: { placeholder: 'Email' }, value: 'john@example.com' },
    { description: { placeholder: 'Phone' }, value: '+1234567890' },
    { description: { placeholder: 'Company' }, value: 'ACME Corp' },
  ];

  for (const field of fields) {
    await LocatorHelper.setValue(field.description, field.value);
    console.log(`Filled field with value: ${field.value}`);
  }

  // Submit
  await LocatorHelper.click({ text: 'Submit' });
}

// ============================================================================
// Example 9: Cache Statistics
// ============================================================================

export async function example9_cacheStatistics() {
  console.log('Example 9: Cache Statistics');

  // Run some operations to populate cache
  await LocatorHelper.click({ text: 'Button' });
  await LocatorHelper.setValue({ placeholder: 'Email' }, 'test@example.com');
  await LocatorHelper.getText({ role: 'alert' });

  // Get statistics
  const stats = LocatorHelper.getLocatorStats();
  console.log(`Total cached entries: ${stats.totalCached}`);
  console.log(`Successful strategies: ${stats.successfulStrategies}`);
  console.log(`Average success rate: ${stats.averageSuccessRate.toFixed(2)}%`);

  // Clear if needed
  if (stats.totalCached > 100) {
    LocatorHelper.clearLocatorCache();
    console.log('Locator cache cleared');
  }
}

// ============================================================================
// Example 10: Advanced - Custom Page Object Pattern
// ============================================================================

abstract class BasePage extends SmartPageObject {
  async getPageTitle(): Promise<string> {
    return this.smartGetText({ role: 'heading' });
  }

  async navigateTo(menuItem: string): Promise<void> {
    await this.smartClick({ text: menuItem });
    await browser.waitUntil(
      async () => (await browser.execute(() => document.readyState)) === 'complete',
      { timeout: 10000 }
    );
  }

  async logout(): Promise<void> {
    await this.smartClick({ ariaLabel: 'User menu' });
    await this.smartClick({ text: 'Logout' });
  }
}

class AdminPageExample extends BasePage {
  constructor() {
    super('Admin Dashboard', 'https://example.com/admin');
  }

  async getUsersTableData(): Promise<{ name: string; email: string; role: string }[]> {
    const rows = await browser.$$('xpath=//table//tbody//tr');
    const data = [];

    for (const row of rows) {
      const cells = await row.$$('td');
      data.push({
        name: await cells[0].getText(),
        email: await cells[1].getText(),
        role: await cells[2].getText(),
      });
    }

    return data;
  }

  async searchUser(email: string): Promise<boolean> {
    await this.smartSetValue({ placeholder: 'Search users' }, email);
    await LocatorHelper.waitForText({ role: 'status' }, 'Results');
    return this.smartTextContains({ role: 'list' }, email);
  }

  async deleteUser(email: string): Promise<void> {
    const found = await this.searchUser(email);
    if (found) {
      const deleteButtons = await browser.$$(
        `xpath=//*[contains(text(), "${email}")]/..//button[contains(text(), "Delete")]`
      );
      if (deleteButtons.length > 0) {
        await deleteButtons[0].click();
        await this.smartClick({ text: 'Confirm Delete' });
      }
    }
  }
}

export async function example10_advancedPageObject() {
  console.log('Example 10: Advanced Page Object Pattern');

  const adminPage = new AdminPageExample();
  await adminPage.open();

  // Get users
  const users = await adminPage.getUsersTableData();
  console.log(`Found ${users.length} users`);

  // Search user
  const found = await adminPage.searchUser('john@example.com');
  console.log(`User found: ${found}`);

  // Navigate
  await adminPage.navigateTo('Reports');

  // Logout
  await adminPage.logout();
}

// ============================================================================
// Example 11: Error Handling
// ============================================================================

export async function example11_errorHandling() {
  console.log('Example 11: Error Handling');

  try {
    // Try to find element with timeout
    await LocatorHelper.waitFor({ text: 'Element that does not exist' }, 2000);
  } catch (error) {
    console.log(`Expected error: ${error}`);
    // Take screenshot for debugging
    await browser.saveScreenshot('./screenshots/error-debug.png');
  }

  // Graceful fallback
  const exists = await LocatorHelper.exists({ text: 'Optional Element' });
  if (!exists) {
    console.log('Optional element not found, continuing...');
  }

  // Conditional verification
  try {
    const message = await LocatorHelper.getText({ role: 'alert' });
    if (message.includes('error')) {
      console.error(`Unexpected error message: ${message}`);
    }
  } catch {
    console.log('No alert message (expected behavior)');
  }
}

// ============================================================================
// Example 12: Integration with Step Definitions (Cucumber)
// ============================================================================

// Note: These would be in step definitions files
// import { Given, When, Then } from '@wdio/cucumber-framework';

export class LoginStepDefinitions {
  private loginPage = new LoginPageExample();

  async givenUserIsOnLoginPage(): Promise<void> {
    await this.loginPage.open();
    console.log('User is on login page');
  }

  async whenUserEntersCredentials(username: string, password: string): Promise<void> {
    await this.loginPage.fillUsername(username);
    await this.loginPage.fillPassword(password);
    console.log('Credentials entered');
  }

  async whenUserClicksLogin(): Promise<void> {
    await this.loginPage.submit();
    console.log('Login button clicked');
  }

  async thenUserShouldSeeSuccessMessage(): Promise<void> {
    const hasError = await this.loginPage.isErrorMessageVisible();
    if (!hasError) {
      console.log('SUCCESS: No error message displayed');
    } else {
      const errorMsg = await this.loginPage.getErrorMessage();
      throw new Error(`LOGIN FAILED: ${errorMsg}`);
    }
  }

  async thenUserShouldSeeErrorMessage(expectedError: string): Promise<void> {
    const hasError = await this.loginPage.isErrorMessageVisible();
    if (hasError) {
      const errorMsg = await this.loginPage.getErrorMessage();
      if (errorMsg?.includes(expectedError)) {
        console.log(`SUCCESS: Expected error message displayed: ${errorMsg}`);
      } else {
        throw new Error(`Unexpected error message: ${errorMsg}`);
      }
    } else {
      throw new Error('Expected error message but none found');
    }
  }
}

// ============================================================================
// Run Examples
// ============================================================================

export async function runAllExamples() {
  console.log('\n============================================');
  console.log('Smart Locators Examples');
  console.log('============================================\n');

  const examples = [
    { name: 'Basic Element Finding', fn: example1_basicElementFinding },
    { name: 'Page Object', fn: example2_pageObject },
    { name: 'Form Filling', fn: example3_formFilling },
    { name: 'Retry Logic', fn: example4_retryLogic },
    { name: 'Wait for Text', fn: example5_waitForText },
    { name: 'Verification', fn: example6_verification },
    { name: 'Action and Verify', fn: example7_actionAndVerify },
    { name: 'Multiple Elements', fn: example8_multipleElements },
    { name: 'Cache Statistics', fn: example9_cacheStatistics },
    { name: 'Advanced Page Object', fn: example10_advancedPageObject },
    { name: 'Error Handling', fn: example11_errorHandling },
  ];

  for (const example of examples) {
    try {
      console.log(`\n→ ${example.name}`);
      // await example.fn();  // Uncomment to run
      console.log(`✓ ${example.name} completed`);
    } catch (error) {
      console.error(`✗ ${example.name} failed: ${error}`);
    }
  }

  console.log('\n============================================');
  console.log('Examples completed');
  console.log('============================================\n');
}