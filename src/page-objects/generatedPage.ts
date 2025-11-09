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
   * Submit
   */
  get submit_button() {
    return $('#submit');
  }

  /**
   * Link: Home
   */
  get home_link() {
    return $('a[href="https://practicetestautomation.com/"]');
  }

  /**
   * Link: Practice
   */
  get practice_link() {
    return $('a[href="https://practicetestautomation.com/practice/"]');
  }

  /**
   * Link: Courses
   */
  get courses_link() {
    return $('a[href="https://practicetestautomation.com/courses/"]');
  }

  /**
   * Link: Blog
   */
  get blog_link() {
    return $('a[href="https://practicetestautomation.com/blog/"]');
  }

  /**
   * Link: Contact
   */
  get contact_link() {
    return $('a[href="https://practicetestautomation.com/contact/"]');
  }

  /**
   * Link: Privacy Policy
   */
  get privacyPolicy_link() {
    return $('a[href="https://practicetestautomation.com/privacy-policy/"]');
  }

  /**
   * Heading (H2): Test login
   */
  get testLogin_heading() {
    return $('h2');
  }

  /**
   * Heading (H5): Test case 1: Positive LogIn test
   */
  get testCase1PositiveLogInTest_heading() {
    return $('h5');
  }

  /**
   * Error message: Your username is invalid!
   */
  get error_error() {
    return $('#error');
  }

  /**
   * Success message: Home
Practice
Courses
Blog
Contact

							
						
   */
  get overflowContainer_success() {
    return $('#overflow-container');
  }

  /**
   * Success message: Home
Practice
Courses
Blog
Contact

							
						
   */
  get maxWidth_success() {
    return $('#max-width');
  }

  /**
   * Text element: Test login
   */
  get test_login_text() {
    return $('h2');
  }

  /**
   * Text element: Test case 1: Positive LogIn test
   */
  get test_case_1_Positive_LogIn_te_text() {
    return $('h5');
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