// Auto-generated Page Object for: https://practicetestautomation.com/practice-test-login/
import { $, browser } from '@wdio/globals';

class GeneratedPage {
  /**
   * Username
   */
  get username_input() {
    return $('#username');
  }

  /**
   * Password
   */
  get password_input() {
    return $('#password');
  }

  /**
   * Button element
   */
  get button0_button() {
    return $('button[type="button"]');
  }

  /**
   * open menu
   */
  get openMenu_button() {
    return $('#toggle-navigation');
  }

  /**
   * Submit
   */
  get submit_button() {
    return $('#submit');
  }

  /**
   * Link: Home
   */
  get home_link() {
    return $('a:contains("Home")');
  }

  /**
   * Link: Practice
   */
  get practice_link() {
    return $('a:contains("Practice")');
  }

  /**
   * Link: Courses
   */
  get courses_link() {
    return $('a:contains("Courses")');
  }

  /**
   * Link: Blog
   */
  get blog_link() {
    return $('a:contains("Blog")');
  }

  /**
   * Link: Contact
   */
  get contact_link() {
    return $('a:contains("Contact")');
  }

  /**
   * Link: Practice Test Automation.
   */
  get practiceTestAutomation_link() {
    return $('a:contains("Practice Test Automation.")');
  }

  /**
   * Link: Privacy Policy
   */
  get privacyPolicy_link() {
    return $('a:contains("Privacy Policy")');
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