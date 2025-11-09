// Auto-generated Page Object for error
// Page URL: https://practicetestautomation.com/practice-test-login/
// Description: Error/validation page
// Elements: error, username, password
import { $, browser } from '@wdio/globals';

class ErrorPage {
  /**
   * Error message
   */
  get error_text() {
    return $('#error, [class*="error"], [id*="error"], [role="alert"], .alert-danger');
  }

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

export default new ErrorPage();
