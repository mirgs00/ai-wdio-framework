// Auto-generated Page Object for: https://practicetestautomation.com/practice-test-login/logged-in-successfully/
import { $, browser } from '@wdio/globals';

class GeneratedPage {
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
    await browser.url('https://practicetestautomation.com/practice-test-login/logged-in-successfully/');
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