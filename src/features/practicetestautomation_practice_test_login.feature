Feature: Test Login | Practice Test Automation Testing

@happy-path @positive
Scenario: Successful Login with Valid Credentials
  Given I am on the login page
  When I enter valid username "admin" and password "password123"
  And I click the "submit" button
  Then I should see a success message "Login successful"

@negative @validation @error
Scenario: Invalid username format
  Given I am on the login page
  When I enter "invalid_username" as my username and "password" as my password
  And I click the "submit" button
  Then I should see "Your username is invalid!"
  And the form remains on the same page

@negative @validation @error
Scenario: Non-existent user
  Given I am on the login page
  When I enter "non_existent_user" as my username and "password" as my password
  And I click the "submit" button
  Then I should see "Your username is invalid!"
  And the form remains on the same page

@validation @positive
Scenario: Invalid username - empty input
  Given The login page is open
  When I fill in the "Username" field with ""
  And I fill in the "Password" field with "valid_password"
  And I click the "submit" button
  Then I should see "Please enter a valid username"

@validation @positive
Scenario: Invalid password - empty input
  Given The login page is open
  When I fill in the "Username" field with "valid_username"
  And I fill in the "Password" field with ""
  And I click the "submit" button
  Then I should see "Please enter a valid password"

@validation @positive
Scenario: Invalid username - invalid characters
  Given The login page is open
  When I fill in the "Username" field with "!@#$"
  And I fill in the "Password" field with "valid_password"
  And I click the "submit" button
  Then I should see "Please enter a valid username"
