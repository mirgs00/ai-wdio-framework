Feature: Flow Matrix Discovery for practicetestautomation.com
  Automatically discovered scenarios via live browser exploration of https://practicetestautomation.com

  @smoke @quick
  Scenario: Homepage loads successfully
    Given the user navigates to "https://practicetestautomation.com"
    Then the page should load successfully
    And the page title should be present

  @smoke @page-type:home
  Scenario: home page loads
    Given the user navigates to "https://practicetestautomation.com"
    Then the home page should be visible

  @smoke @page-type:listing
  Scenario: listing page loads
    Given the user navigates to "https://practicetestautomation.com"
    Then the listing page should be visible

  @smoke @page-type:generic
  Scenario: generic page loads
    Given the user navigates to "https://practicetestautomation.com"
    Then the generic page should be visible

  @smoke @page-type:form
  Scenario: form page loads
    Given the user navigates to "https://practicetestautomation.com"
    Then the form page should be visible

  @discovered @page-type:listing
  Scenario: Navigate to Listing page: Practice | Practice Test Automation
    Given the user navigates to "https://practicetestautomation.com"
    When the user clicks "Practice"
    Then the page title should contain "Practice | Practice Test Automation"
    Then the URL should contain "/practice/"
    Then the user should see "Press "Enter" to skip to content"

  @discovered @page-type:home
  Scenario: Navigate to Home page: Courses | Practice Test Automation
    Given the user navigates to "https://practicetestautomation.com"
    When the user clicks "Courses"
    Then the page title should contain "Courses | Practice Test Automation"
    Then the URL should contain "/courses/"
    Then the user should see "Press "Enter" to skip to content"

  @discovered @page-type:generic
  Scenario: Navigate to Generic page: AI for Test Automation: A Live, Hands-On Workshop · Luma
    Given the user navigates to "https://practicetestautomation.com"
    When the user clicks "AI Workshop"
    Then the page title should contain "AI for Test Automation: A Live, Hands-On Workshop · Luma"
    Then the URL should contain "/6h5rs59m"
    Then the user should see "Discover Events"

  @discovered @page-type:listing
  Scenario: Navigate to Listing page: Blog | Practice Test Automation
    Given the user navigates to "https://practicetestautomation.com"
    When the user clicks "Blog"
    Then the page title should contain "Blog | Practice Test Automation"
    Then the URL should contain "/blog/"
    Then the user should see "Press "Enter" to skip to content"

  @discovered @page-type:home
  Scenario: Navigate to Home page: Contact | Practice Test Automation | Selenium WebDriver
    Given the user navigates to "https://practicetestautomation.com"
    When the user clicks "Contact"
    Then the page title should contain "Contact | Practice Test Automation | Selenium WebDriver"
    Then the URL should contain "/contact/"
    Then the user should see "Press "Enter" to skip to content"

  @discovered @page-type:generic
  Scenario: Navigate to Generic page: AI for Test Automation: A Live, Hands-On Workshop · Luma
    Given the user navigates to "https://practicetestautomation.com"
    When the user clicks "AI Workshop"
    When the user clicks "Kin Cheung"
    Then the page title should contain "AI for Test Automation: A Live, Hands-On Workshop · Luma"
    Then the URL should contain "/6h5rs59m"
    Then the user should see "Discover Events"

  @discovered @page-type:form
  Scenario: Navigate to Form page: AI for Test Automation: A Live, Hands-On Workshop · Luma
    Given the user navigates to "https://practicetestautomation.com"
    When the user clicks "AI Workshop"
    When the user clicks "Contact the Host"
    Then the page title should contain "AI for Test Automation: A Live, Hands-On Workshop · Luma"
    Then the URL should contain "/6h5rs59m"
    Then the user should see "Discover Events"

  @discovered @page-type:form
  Scenario: Navigate to Form page: AI for Test Automation: A Live, Hands-On Workshop · Luma
    Given the user navigates to "https://practicetestautomation.com"
    When the user clicks "AI Workshop"
    When the user clicks "Report Event"
    Then the page title should contain "AI for Test Automation: A Live, Hands-On Workshop · Luma"
    Then the URL should contain "/6h5rs59m"
    Then the user should see "Discover Events"

  @discovered @page-type:generic
  Scenario: Navigate to Generic page: AI for Test Automation: A Live, Hands-On Workshop · Luma
    Given the user navigates to "https://practicetestautomation.com"
    When the user clicks "AI Workshop"
    When the user clicks "jsx-b81a950127e7f0cc"
    Then the page title should contain "AI for Test Automation: A Live, Hands-On Workshop · Luma"
    Then the URL should contain "/6h5rs59m"
    Then the user should see "Discover Events"
