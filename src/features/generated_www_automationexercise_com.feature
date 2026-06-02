Feature: Full E-Commerce Flow for www.automationexercise.com
  Automatically discovered and manually verified scenarios for Automation Exercise demo site

  @discovered @page-type:product
  Scenario: Navigate to homepage
    Given the user navigates to "https://www.automationexercise.com"
    Then the page title should contain "Automation Exercise"
    Then the URL should contain "/"
    Then the user should see "AutomationExercise"

  @discovered @page-type:form
  Scenario: Navigate to API testing page
    Given the user navigates to "https://www.automationexercise.com/api_list"
    Then the page title should contain "API Testing"

  @discovered @page-type:product
  Scenario: Navigate to Test Cases page
    Given the user navigates to "https://www.automationexercise.com/test_cases"
    Then the page title should contain "Test Cases"
    Then the URL should contain "/test_cases"

  @e2e @flow:registration @time-sensitive
  Scenario: Register a new user account
    Given the user navigates to "https://www.automationexercise.com/login"
    When the user fills "input[data-qa='signup-name']" with "TestUser"
    When the user fills "input[data-qa='signup-email']" with "ae_user_@TIMESTAMP@@test.com"
    When the user clicks element "button[data-qa='signup-button']"
    Then the URL should contain "/signup"
    When the user clicks "#id_gender1"
    When the user fills "#password" with "TestPass123!"
    When the user selects "1" from "#days"
    When the user selects "June" from "#months"
    When the user selects "2000" from "#years"
    When the user checks "#newsletter"
    When the user fills "#first_name" with "Test"
    When the user fills "#last_name" with "User"
    When the user fills "#company" with "TestCo"
    When the user fills "#address1" with "123 Test Street"
    When the user fills "#address2" with "Suite 1"
    When the user selects "India" from "#country"
    When the user fills "#state" with "Victoria"
    When the user fills "#city" with "Melbourne"
    When the user fills "#zipcode" with "3000"
    When the user fills "#mobile_number" with "0412345678"
    When the user clicks element "button[data-qa='create-account']"
    Then the URL should contain "/account_created"
    Then the user should see "ACCOUNT CREATED"
    When the user clicks "Continue"
    When the user navigates to "https://www.automationexercise.com/delete_account"
    Then the URL should contain "/delete_account"
    Then the user should see "Account Deleted!"
    When the user clicks "Continue"

  @e2e @flow:products
  Scenario: Browse products and view details
    Given the user navigates to "https://www.automationexercise.com/products"
    Then the URL should contain "/products"
    Then the user should see "All Products"
    When the user navigates to "https://www.automationexercise.com/product_details/1"
    Then the URL should contain "/product_details/1"
    Then the user should see "Blue Top"

  @e2e @flow:cart
  Scenario: Add product to cart and complete checkout
    Given the user navigates to "https://www.automationexercise.com"
    When the user navigates to "https://www.automationexercise.com/view_cart"
    Then the URL should contain "/view_cart"
    When the user navigates to "https://www.automationexercise.com/product_details/1"
    When the user clicks "Add to cart"
    When the user navigates to "https://www.automationexercise.com/view_cart"
    Then the URL should contain "/view_cart"
    When the user clicks element "a.check_out"
    Then the page title should contain "Automation Exercise"
    When the user navigates to "https://www.automationexercise.com/payment"
    Then the URL should contain "/payment"
    When the user fills "input[data-qa='name-on-card']" with "Test User"
    When the user fills "input[data-qa='card-number']" with "4111111111111111"
    When the user fills "input[data-qa='cvc']" with "311"
    When the user fills "input[data-qa='expiry-month']" with "12"
    When the user fills "input[data-qa='expiry-year']" with "2027"
    When the user clicks element "button[data-qa='pay-button']"
    Then the URL should contain "/payment_done"
    Then the user should see "Order Placed!"
    When the user navigates to "https://www.automationexercise.com/delete_account"
    Then the URL should contain "/delete_account"
    Then the user should see "Account Deleted!"
    When the user clicks "Continue"
