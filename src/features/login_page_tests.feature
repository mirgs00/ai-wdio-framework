Feature: Login Page Tests
  Test the login page with positive and negative credential flows

@happy-path @positive
Scenario: Successful Login
  Given the user navigates to to login page
  When the user enters username "student"
  When the user enters password "Password123"
  When the user clicks login button
  Then the user sees page header containing text "Logged In Successfully"

@negative
Scenario: Failed Login
  Given the user navigates to to login page
  When the user enters username "wrong_username"
  When the user enters password "wrong_password"
  When the user clicks login button
  Then the user sees error message about invalid credentials

@negative @validation
Scenario: Invalid Username
  Given the user navigates to to login page
  When the user enters username "invalid_user"
  When the user enters password "Password123"
  When the user clicks submit button
  Then the user sees error message about username format

@negative @validation
Scenario: Missing Password
  Given the user navigates to to login page
  When the user enters username "student"
  When the user leaves password field empty
  When the user clicks submit button
  Then the user sees error message that password is required