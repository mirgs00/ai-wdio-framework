// Auto-generated Page Object for: https://practicetestautomation.com/practice-test-login/logged-in-successfully/
import { $, browser } from '@wdio/globals';
import { ChainablePromiseElement } from 'webdriverio';

class GeneratedPage {
  /**
   * Heading (H2): Test login
   */
  public get testLogin_heading(): ChainablePromiseElement<WebdriverIO.Element> {
    return $('h2');
  }

  /**
   * Heading (H5): Test case 1: Positive LogIn test
   */
  public get testCase1PositiveLogInTest_heading(): ChainablePromiseElement<WebdriverIO.Element> {
    return $('h5');
  }

  /**
   * Success message: Home
Practice
Courses
Blog
Contact

							
						
   */
  public get overflowContainer_success(): ChainablePromiseElement<WebdriverIO.Element> {
    return $('#overflow-container');
  }

  /**
   * Success message: Home
Practice
Courses
Blog
Contact

							
						
   */
  public get maxWidth_success(): ChainablePromiseElement<WebdriverIO.Element> {
    return $('#max-width');
  }

  /**
   * Text element: Test login
   */
  public get test_login_text(): ChainablePromiseElement<WebdriverIO.Element> {
    return $('h2');
  }

  /**
   * Text element: Test case 1: Positive LogIn test
   */
  public get test_case_1_Positive_LogIn_te_text(): ChainablePromiseElement<WebdriverIO.Element> {
    return $('h5');
  }

  // Common actions
  async open(): Promise<void> {
    await browser.url('https://practicetestautomation.com/practice-test-login/logged-in-successfully/');
    await this.waitForPageLoad();
  }

  async waitForPageLoad(): Promise<void> {
    await browser.waitUntil(
      async () => (await browser.execute(() => document.readyState)) === 'complete',
      { timeout: 15000, timeoutMsg: 'Page did not load' }
    );
  }
}

export const generatedPage = new GeneratedPage();
export default GeneratedPage;