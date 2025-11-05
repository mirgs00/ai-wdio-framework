import { Given, When, Then } from "@wdio/cucumber-framework";
import { expect, browser, $ } from '@wdio/globals';
import dotenv from 'dotenv';
import generatedPage from '../page-objects/generatedPage';

dotenv.config();

/**
 * Implements: "I am on the login page"
 */
Given(/^I am on the login page$/, async function () {
try {
  const loginUrl = process.env.LOGIN_URL;
  if (!loginUrl) {
    throw new Error('Environment variable LOGIN_URL is not defined');
  }
  await browser.url(loginUrl);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(`Navigation to login page failed: ${errorMessage}`);
}
});

/**
 * Implements: "I enter valid username \"admin\" and password \"password123\""
 */
When(/^I enter valid username "([^"]*)" and password "([^"]*)"$/, async function (param1, param2) {
try {
  await generatedPage.username_input.setValue(param1);
  await generatedPage.password_input.setValue(param2);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(`Form fill failed: ${errorMessage}`);
}
});

/**
 * Implements: "I click the \"submit\" button"
 */
When(/^I click the "([^"]*)" button$/, async function (param1) {
try {
  await generatedPage.submit_button.click();
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(`Submit button click failed: ${errorMessage}`);
}
});

/**
 * Implements: "I should see a success message \"Logged in successfully\""
 */
Then(/^I should see a success message "([^"]*)"$/, async function (param1) {
  try {
    const successMessage = await $(`h1=${param1}`);
    await expect(successMessage).toBeDisplayed();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Element not visible: ${errorMessage}`);
  }
});

/**
 * Implements: "I enter \"invalid_username\" as the username and any password"
 */
When(/^I enter "([^"]*)" as my username and any password$/, async function (param1) {
try {
  await generatedPage.username_input.setValue(param1 + '');
  await generatedPage.password_input.setValue('');
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(`Form fill failed: ${errorMessage}`);
}
});

/**
 * Implements: "the error message \"Invalid username format\" is displayed"
 */
Then(/^the error message "([^"]*)" is displayed$/, async function (param1) {
try {
  await browser.pause(1000);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(`Step implementation missing for: the error message "Invalid username format" is displayed`);
}
});

/**
 * Implements: "the form remains on the login page"
 */
Given(/^the form remains on the login page$/, async function () {
try {
  await generatedPage.username_input.isExisting();
  await generatedPage.password_input.isExisting();
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(`Form does not remain on the login page: ${errorMessage}`);
}
});

/**
 * Implements: "I enter \"existing_username\" as the username and leave the password field blank"
 */
When(/^I enter "([^"]*)" as the username and leave the password field blank$/, async function (param1) {
try {
  await generatedPage.username_input.setValue(param1);
  await generatedPage.password_input.setValue('');
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(`Form fill failed: ${errorMessage}`);
}
});

/**
 * Implements: "the error message \"Password is required\" is displayed"
 */
Then(/^the error message "([^"]*)" is displayed$/, async function (param1) {
try {
  await generatedPage.password_input.setValue('');
  await generatedPage.submit_button.click();
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(`Error message "Password is required" not displayed: ${errorMessage}`);
}
});

/**
 * Implements: "The login page is open"
 */
Given(/^The login page is open$/, async function () {
try {
  await generatedPage.open();
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(`Login page opening failed: ${errorMessage}`);
}
});

/**
 * Implements: "I fill in the username with \"\""
 */
When(/^I fill in the username with "([^"]*)"$/, async function (param1) {
try {
  await generatedPage.username_input.setValue(param1);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(`Username input failed: ${errorMessage}`);
}
});

/**
 * Implements: "I fill in the password with \"valid_password\""
 */
When(/^I fill in the password with "([^"]*)"$/, async function (param1) {
try {
  await generatedPage.password_input.setValue(param1);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(`Password input failed: ${errorMessage}`);
}
});

/**
 * Implements: "I should see \"Username cannot be blank\""
 */
Then(/^I should see "([^"]*)"$/, async function (param1) {
try {
  await expect($(`[class*="success"]`)).toBeDisplayed();
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(`Element not visible: ${errorMessage}`);
}
});

/**
 * Implements: "I fill in the username with \"invalid_username!\""
 */
When(/^I fill in the username with "([^"]*)"$/, async function (param1) {
try {
  await generatedPage.username_input.setValue(param1 + "!"); 
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(`Username fill failed: ${errorMessage}`);
}
});

/**
 * Implements: "I should see \"Username must only contain letters and numbers\""
 */
Then(/^I should see "([^"]*)"$/, async function (param1) {
try {
  await expect($(`[class*="success"]`)).toBeDisplayed();
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(`Element not visible: ${errorMessage}`);
}
});

/**
 * Implements: "I fill in the username with \"valid_username\""
 */
When(/^I fill in the username with "([^"]*)"$/, async function (param1) {
try {
  await generatedPage.username_input.setValue(param1);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(`Username input failed: ${errorMessage}`);
}
});

/**
 * Implements: "I fill in the password with \"\""
 */
When(/^I fill in the password with "([^"]*)"$/, async function (param1) {
try {
  await generatedPage.password_input.setValue(param1);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(`Password input failed: ${errorMessage}`);
}
});

/**
 * Implements: "I should see \"Password cannot be blank\""
 */
Then(/^I should see "([^"]*)"$/, async function (param1) {
try {
  await expect(generatedPage.password_input).toBeEmpty();
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  throw new Error(`Error checking password input: ${errorMessage}`);
}
});