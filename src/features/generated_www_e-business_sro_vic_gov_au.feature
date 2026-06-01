Feature: Flow Matrix Discovery for www.e-business.sro.vic.gov.au
  Automatically discovered scenarios via live browser exploration of https://www.e-business.sro.vic.gov.au/calculators/livestock-duty

  @discovered @page-type:form
  Scenario: Navigate to Form page: Livestock duty calculator | State Revenue Office
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user submits the form
    Then the page title should contain "Livestock duty calculator | State Revenue Office"
    Then the URL should contain "/calculators/livestock-duty"
    Then the user should see "livestock duty"

  @discovered @page-type:form
  Scenario: Navigate to Form page: Livestock duty calculator | State Revenue Office
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user clicks "livestockTypeCattle"
    Then the page title should contain "Livestock duty calculator | State Revenue Office"
    Then the URL should contain "/calculators/livestock-duty"
    Then the user should see "livestock duty"

  @discovered @page-type:form
  Scenario: Navigate to Form page: Livestock duty calculator | State Revenue Office
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user clicks "livestockTypeSheepNGoat"
    Then the page title should contain "Livestock duty calculator | State Revenue Office"
    Then the URL should contain "/calculators/livestock-duty"
    Then the user should see "livestock duty"

  @discovered @page-type:form
  Scenario: Navigate to Form page: Livestock duty calculator | State Revenue Office
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user clicks "livestockTypeSwine"
    Then the page title should contain "Livestock duty calculator | State Revenue Office"
    Then the URL should contain "/calculators/livestock-duty"
    Then the user should see "livestock duty"

  @discovered @page-type:form
  Scenario: Navigate to Form page: Livestock duty calculator | State Revenue Office
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user submits the form
    When the user submits the form
    Then the page title should contain "Livestock duty calculator | State Revenue Office"
    Then the URL should contain "/calculators/livestock-duty"
    Then the user should see "livestock duty"

  @discovered @page-type:form
  Scenario: Navigate to Form page: Livestock duty calculator | State Revenue Office
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user clicks "livestockTypeSwine"
    When the user fills "#primaryPigsValue" with "500000"
    When the user fills "#secondaryPigsValue" with "500000"
    When the user submits the form
    Then the page title should contain "Livestock duty calculator | State Revenue Office"
    Then the URL should contain "/calculators/livestock-duty"
    Then the user should see "livestock duty"

  @discovered @page-type:form
  Scenario: Navigate to Form page: Livestock duty calculator | State Revenue Office
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user submits the form
    When the user submits the form
    When the user fills "#primaryPigsValue" with "500000"
    When the user fills "#secondaryPigsValue" with "500000"
    When the user submits the form
    Then the page title should contain "Livestock duty calculator | State Revenue Office"
    Then the URL should contain "/calculators/livestock-duty"
    Then the user should see "livestock duty"

  @discovered @page-type:form @radio-variant
  Scenario: form with "livestockTypeCattle" and submit
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user clicks "livestockTypeCattle"
    When the user submits the form
    Then the page title should contain "Livestock duty calculator | State Revenue Office"
    Then the URL should contain "/calculators/livestock-duty"
    Then the user should see "livestock duty"

  @discovered @page-type:form @radio-matrix
  Scenario: form chain "livestockTypeCattle" → form with "livestockTypeCattle" and submit
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user clicks "livestockTypeCattle"
    When the user clicks "livestockTypeCattle"
    When the user submits the form
    Then the page title should contain "Livestock duty calculator | State Revenue Office"
    Then the URL should contain "/calculators/livestock-duty"
    Then the user should see "livestock duty"

  @discovered @page-type:form @radio-matrix
  Scenario: form chain "livestockTypeCattle" → form with "livestockTypeSheepNGoat" and submit
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user clicks "livestockTypeCattle"
    When the user clicks "livestockTypeSheepNGoat"
    When the user fills "#primarySheepValue" with "500000"
    When the user submits the form
    Then the page title should contain "Livestock duty calculator | State Revenue Office"
    Then the URL should contain "/calculators/livestock-duty"
    Then the user should see "livestock duty"

  @discovered @page-type:form @radio-matrix
  Scenario: form chain "livestockTypeCattle" → form with "livestockTypeSwine" and submit
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user clicks "livestockTypeCattle"
    When the user clicks "livestockTypeSwine"
    When the user fills "#primaryPigsValue" with "500000"
    When the user fills "#secondaryPigsValue" with "500000"
    When the user submits the form
    Then the page title should contain "Livestock duty calculator | State Revenue Office"
    Then the URL should contain "/calculators/livestock-duty"
    Then the user should see "livestock duty"

  @discovered @page-type:form @radio-matrix
  Scenario: form chain "livestockTypeCattle" → form selecting "cattleTypeCattle"
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user clicks "livestockTypeCattle"
    When the user clicks "cattleTypeCattle"
    When the user submits the form
    Then the page title should contain "Livestock duty calculator | State Revenue Office"
    Then the URL should contain "/calculators/livestock-duty"
    Then the user should see "livestock duty"

  @discovered @page-type:form @radio-matrix
  Scenario: form chain "livestockTypeCattle" → form selecting "cattleTypeCalve"
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user clicks "livestockTypeCattle"
    When the user clicks "cattleTypeCalve"
    When the user submits the form
    Then the page title should contain "Livestock duty calculator | State Revenue Office"
    Then the URL should contain "/calculators/livestock-duty"
    Then the user should see "livestock duty"

  @discovered @page-type:form @radio-matrix
  Scenario: form chain "livestockTypeCattle" → form selecting "cattleTypeCattleCarcass"
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user clicks "livestockTypeCattle"
    When the user clicks "cattleTypeCattleCarcass"
    When the user submits the form
    Then the page title should contain "Livestock duty calculator | State Revenue Office"
    Then the URL should contain "/calculators/livestock-duty"
    Then the user should see "livestock duty"

  @discovered @page-type:form @radio-variant
  Scenario: form with "livestockTypeSheepNGoat" and submit
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user clicks "livestockTypeSheepNGoat"
    When the user fills "#primarySheepValue" with "500000"
    When the user submits the form
    Then the page title should contain "Livestock duty calculator | State Revenue Office"
    Then the URL should contain "/calculators/livestock-duty"
    Then the user should see "livestock duty"
