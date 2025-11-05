Feature: Test Login | Practice Test Automation Testing

@happy-path @positive
Scenario: Successful Login with Valid Credentials
  Given I am on the login page
  When I enter valid username "student" and password "Password123"
  And I click the "submit" button
  Then I should see a success message "Logged In Successfully"

@negative @validation @error
Scenario: Invalid username format
  Given I am on the login page
  When I enter "invalid_username" as my username and any password
  And I click the "submit" button
  Then the error message "Invalid username format" is displayed
  And the form remains on the login page

@negative @validation @error
Scenario: Missing required password field
  Given I am on the login page
  When I enter "student" as the username and leave the password field blank
  And I click the "submit" button
  Then the error message "Password is required" is displayed
  And the form remains on the login page

@validation @positive
Scenario: Invalid username - empty
  Given The login page is open
  When I fill in the username with ""
  And I fill in the password with "valid_password"
  And I click the "submit" button
  Then I should see "Username cannot be blank"

@validation @positive
Scenario: Invalid username - invalid characters
  Given The login page is open
  When I fill in the username with "invalid_username!"
  And I fill in the password with "valid_password"
  And I click the "submit" button
  Then I should see "Username must only contain letters and numbers"

@validation @positive
Scenario: Invalid password - empty
  Given The login page is open
  When I fill in the username with "valid_username"
  And I fill in the password with ""
  And I click the "submit" button
  Then I should see "Password cannot be blank"
