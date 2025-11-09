// Auto-generated Page Object for dashboard
// Page URL: https://practicetestautomation.com/practice-test-login/logged-in-successfully/
// Description: Dashboard page after successful login
// Elements: success, loggedInHeading
import { $, browser } from '@wdio/globals';

class DashboardPage {
  /**
   * Success message
   */
  get success_text() {
    return $(
      'h1.post-title, #success, [class*="success"], [id*="success"], .alert-success, [class*="confirmation"]'
    );
  }

  /**
   * Logged in success heading
   */
  get loggedInHeading_text() {
    return $('h1, h2, [class*="heading"], [class*="title"]');
  }

  // Common actions
  async open() {
    await browser.url(
      'https://practicetestautomation.com/practice-test-login/logged-in-successfully/'
    );
    await this.waitForPageLoad();
  }

  async waitForPageLoad() {
    await browser.waitUntil(
      async () => (await browser.execute(() => document.readyState)) === 'complete',
      { timeout: 15000, timeoutMsg: 'Page did not load' }
    );
  }
}

export default new DashboardPage();
