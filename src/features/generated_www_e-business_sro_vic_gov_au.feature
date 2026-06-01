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
  Scenario: Select Cattle radio
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user clicks "livestockTypeCattle"
    Then the page title should contain "Livestock duty calculator | State Revenue Office"
    Then the URL should contain "/calculators/livestock-duty"

  @discovered @page-type:form
  Scenario: Select Sheep and goats radio
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user clicks "livestockTypeSheepNGoat"
    Then the page title should contain "Livestock duty calculator | State Revenue Office"
    Then the URL should contain "/calculators/livestock-duty"

  @discovered @page-type:form
  Scenario: Select Pigs radio
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user clicks "livestockTypeSwine"
    Then the page title should contain "Livestock duty calculator | State Revenue Office"
    Then the URL should contain "/calculators/livestock-duty"

  @discovered @page-type:form @radio-variant
  Scenario: Select Cattle and submit with defaults
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user clicks "livestockTypeCattle"
    When the user submits the form
    Then the page title should contain "Livestock duty calculator | State Revenue Office"
    Then the URL should contain "/calculators/livestock-duty"

  @discovered @page-type:form @radio-matrix
  Scenario: Cattle cascade: select Cattle
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user clicks "livestockTypeCattle"
    When the user clicks "cattleTypeCattle"
    Then the page title should contain "Livestock duty calculator | State Revenue Office"
    Then the URL should contain "/calculators/livestock-duty"

  @discovered @page-type:form @radio-matrix
  Scenario: Cattle cascade: select Calf
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user clicks "livestockTypeCattle"
    When the user clicks "cattleTypeCalve"
    Then the page title should contain "Livestock duty calculator | State Revenue Office"
    Then the URL should contain "/calculators/livestock-duty"

  @discovered @page-type:form @radio-matrix
  Scenario: Cattle cascade: select Cattle carcass
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user clicks "livestockTypeCattle"
    When the user clicks "cattleTypeCattleCarcass"
    Then the page title should contain "Livestock duty calculator | State Revenue Office"
    Then the URL should contain "/calculators/livestock-duty"

  @calculation @livestock:sheep
  Scenario: Calculate duty for 50 sheep and goats
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user clicks "livestockTypeSheepNGoat"
    When the user fills "#primarySheepValue" with "50"
    When the user submits the form
    Then the calculated duty should be "17.50"

  @calculation @livestock:pigs
  Scenario: Calculate duty for 20 pigs at $5,000 total
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user clicks "livestockTypeSwine"
    When the user fills "#primaryPigsValue" with "20"
    When the user fills "#secondaryPigsValue" with "5000"
    When the user submits the form
    Then the calculated duty should be "3.20"

  @calculation @livestock:cattle @cattle:adult
  Scenario: Calculate duty for 10 head of cattle at $15,000 total
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user clicks "livestockTypeCattle"
    When the user clicks "cattleTypeCattle"
    When the user fills "#primaryCattleValue" with "10"
    When the user fills "#secondaryCattleValue" with "15000"
    When the user submits the form
    Then the calculated duty should be "37.50"

  @calculation @livestock:cattle @cattle:calves
  Scenario: Calculate duty for 8 calves
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user clicks "livestockTypeCattle"
    When the user clicks "cattleTypeCalve"
    When the user fills "#primaryCalfValue" with "8"
    When the user submits the form
    Then the calculated duty should be "1.20"

  @calculation @livestock:cattle @cattle:carcass
  Scenario: Calculate duty for 5 light + 3 heavy cattle carcasses
    Given the user navigates to "https://www.e-business.sro.vic.gov.au/calculators/livestock-duty"
    When the user clicks "livestockTypeCattle"
    When the user clicks "cattleTypeCattleCarcass"
    When the user fills "#primaryCattleCarcassValue" with "5"
    When the user fills "#secondaryCattleCarcassValue" with "3"
    When the user submits the form
    Then the calculated duty should be "8.40"
