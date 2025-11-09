// Auto-generated Page Object for login
// Page URL: https://practicetestautomation.com/practice-test-login/
// Description: Login page
// Elements: username, password, submit, error
import { $, browser } from '@wdio/globals';

class LoginPage {
  /**
   * Username input field
   */
  get username_input() {
    return $('#username');
  }

  /**
   * Password input field
   */
  get password_input() {
    return $('#password');
  }

  /**
   * Submit button
   */
  get submit_button() {
    return $('#submit');
  }

  /**
   * Error message
   */
  get error_text() {
    return $('#error, [class*="error"], [id*="error"], [role="alert"], .alert-danger');
  }

  // Common actions
  async open() {
    await browser.url('https://practicetestautomation.com/practice-test-login/');
    await this.waitForPageLoad();
  }

  async waitForPageLoad() {
    await browser.waitUntil(
      async () => (await browser.execute(() => document.readyState)) === 'complete',
      { timeout: 15000, timeoutMsg: 'Page did not load' }
    );
  }
}

export default new LoginPage();
