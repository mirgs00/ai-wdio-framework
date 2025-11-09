// Auto-generated Page Object for: https://practicetestautomation.com/practice-test-login/
// Generated from instructions: Test the login page with positive and negative credential flows
import { $, browser } from '@wdio/globals';

class GeneratedPage {

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
   * Success message
   */
  get success_text() {
    return $('#success, [class*="success"], [id*="success"], .alert-success, [class*="confirmation"]');
  }

  /**
   * Logged in success heading
   */
  get loggedInHeading_text() {
    return $('h1, h2, [class*="heading"], [class*="title"]');
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

export default new GeneratedPage();