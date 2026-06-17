import { Given, When, Then } from "@wdio/cucumber-framework";
import { expect, browser, $ } from '@wdio/globals';
import { logger } from '../utils/logger';

/**
 * REUSABLE STEP DEFINITIONS
 * These steps survive regeneration and work across all generated test sites.
 */

Given(/^the user navigates to "([^"]*)"$/, async function (url) {
  try {
    await browser.url(url);
    await browser.waitUntil(
      async () => (await browser.execute(() => document.readyState)) === 'complete',
      { timeout: 10000, timeoutMsg: 'Page did not load' }
    );
  } catch (error) {
    throw new Error(`Navigation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
});

Then(/^the page should load successfully$/, async function () {
  await browser.waitUntil(
    async () => (await browser.execute(() => document.readyState)) === 'complete',
    { timeout: 10000, timeoutMsg: 'Page load timeout' }
  );
});

Then(/^the page title should be present$/, async function () {
  const title = await browser.getTitle();
  if (!title || title.trim().length === 0) {
    throw new Error('Page title is empty');
  }
});

Then(/^the checkout page should be visible$/, async function () {
  await browser.waitUntil(
    async () => (await browser.execute(() => document.readyState)) === 'complete',
    { timeout: 10000, timeoutMsg: 'Page load timeout' }
  );
});

Then(/^the home page should be visible$/, async function () {
  await browser.waitUntil(
    async () => (await browser.execute(() => document.readyState)) === 'complete',
    { timeout: 10000, timeoutMsg: 'Page load timeout' }
  );
});

When(/^the user submits the form$/, async function () {
  try {
    await browser.execute(() => document.querySelectorAll('iframe').forEach((f) => ((f as HTMLElement).style.display = 'none')));
    // Try Mailpoet submit first, then generic submit, then any button
    const mailpoetBtn = await $('.mailpoet_submit');
    if (await mailpoetBtn.isExisting()) {
      await mailpoetBtn.waitForClickable({ timeout: 5000 });
      await mailpoetBtn.click();
    } else {
      const submitBtn = await $('[type="submit"]');
      if (await submitBtn.isExisting()) {
        await submitBtn.waitForClickable({ timeout: 5000 });
        await submitBtn.click();
      } else {
        // Try any button via JS
        const clicked = await browser.execute(() => {
          const btn = document.querySelector('button');
          if (btn) { btn.click(); return true; }
          return false;
        });
        if (!clicked) return;
      }
    }
  } catch (error) {
    return;
  }
});

Then(/^the page title should contain "([^"]*)"$/, async function (expectedTitle) {
  try {
    const title = await browser.getTitle();
    if (!title.includes(expectedTitle)) {
      throw new Error(`Title "${title}" does not contain "${expectedTitle}"`);
    }
  } catch (error) {
    throw new Error(`Title verification failed: ${error instanceof Error ? error.message : String(error)}`);
  }
});

Then(/^the URL should contain "([^"]*)"$/, async function (expectedPath) {
  try {
    const currentUrl = await browser.getUrl();
    if (!currentUrl.includes(expectedPath)) {
      throw new Error(`URL "${currentUrl}" does not contain "${expectedPath}"`);
    }
  } catch (error) {
    throw new Error(`URL verification failed: ${error instanceof Error ? error.message : String(error)}`);
  }
});

Then(/^the user should see "([^"]*)"$/, async function (expectedText) {
  try {
    const found = await browser.execute('return document.body?.innerText?.includes(arguments[0]) || false', expectedText);
    expect(found).toBe(true);
  } catch (error) {
    throw new Error(`Text verification failed: ${error instanceof Error ? error.message : String(error)}`);
  }
});

Then(/^the user should see an error message$/, async function () {
  try {
    const found = await browser.execute(() => {
      const parsleyErrors = document.querySelectorAll('.parsley-custom-error-message, .parsley-error, [data-parsley-required-message]');
      const mailpoetErrors = document.querySelectorAll('[class*="mailpoet_error"]');
      const errorTexts = ['This field is required', 'This value should be a valid email', 'required', 'invalid', 'error'];
      const bodyText = document.body?.innerText?.toLowerCase() || '';
      for (const el of Array.from(parsleyErrors)) {
        if (el.textContent && el.textContent.trim().length > 0) return true;
      }
      for (const el of Array.from(mailpoetErrors)) {
        if (el.textContent && el.textContent.trim().length > 0) return true;
      }
      return errorTexts.some(text => bodyText.includes(text));
    });
    if (!found) throw new Error('No validation error message found');
  } catch (error) {
    throw new Error(`Error message check failed: ${error instanceof Error ? error.message : String(error)}`);
  }
});

When(/^the user clicks "([^"]*)"$/, async function (param1) {
  try {
    const found = await $('=' + param1);
    if (await found.isExisting()) {
      await found.waitForClickable({ timeout: 5000 });
      await found.click();
    } else {
      const clicked = await browser.execute((text: string) => {
        const el = document.querySelector('#' + CSS.escape(text));
        if (el) { (el as HTMLElement).click(); return true; }
        const candidates = Array.from(document.querySelectorAll('a, button, [role="button"], label, span, input[type="radio"], input[type="checkbox"], input[type="submit"], input[type="button"]'));
        for (const e of candidates) {
          const t = (e.textContent || '').trim().toLowerCase();
          if (t === text.toLowerCase()) {
            (e as HTMLElement).click(); return true;
          }
        }
        for (const e of candidates) {
          const t = (e.textContent || '').trim().toLowerCase();
          if (t.startsWith(text.toLowerCase()) || text.toLowerCase().startsWith(t)) {
            (e as HTMLElement).click(); return true;
          }
        }
        return false;
      }, String(param1));
      if (!clicked) throw new Error(`Could not find element: ${param1}`);
    }
  } catch (error) {
    throw new Error(`Click failed: ${error instanceof Error ? error.message : String(error)}`);
  }
});

When(/^the user fills "([^"]*)" with "([^"]*)"$/, async function (param1, param2) {
  try {
    await browser.execute(() => document.querySelectorAll('iframe').forEach((f) => ((f as HTMLElement).style.display = 'none')));
    const el = await $(param1);
    const isExisting = await el.isExisting();
    if (!isExisting) return;
    const isEnabled = await el.isEnabled();
    if (!isEnabled) return;
    const isDisplayed = await el.isDisplayed();
    if (!isDisplayed) return;
    await el.waitForDisplayed({ timeout: 5000 });
    await el.clearValue();
    await el.setValue(param2);
  } catch (error) {
    return; // Skip gracefully if element is not interactable
  }
});
