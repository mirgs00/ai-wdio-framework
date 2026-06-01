export interface LandTaxTestCase {
  scenario: string;
  calculator: 'general' | 'trust';
  year: number;
  absenteeOwner: boolean;
  taxableValue: number;
  expectedTax: number;
}

export const LAND_TAX_RATES_2026: LandTaxTestCase[] = [
  // General rates (Individual/Company, not absentee)
  { scenario: 'Below threshold (nil)', calculator: 'general', year: 2026, absenteeOwner: false, taxableValue: 0, expectedTax: 0.00 },
  { scenario: 'Just below $50K threshold', calculator: 'general', year: 2026, absenteeOwner: false, taxableValue: 49999, expectedTax: 0.00 },
  { scenario: 'At $50K threshold (entry)', calculator: 'general', year: 2026, absenteeOwner: false, taxableValue: 50000, expectedTax: 500.00 },
  { scenario: 'Top of $50K-$100K bracket', calculator: 'general', year: 2026, absenteeOwner: false, taxableValue: 99999, expectedTax: 500.00 },
  { scenario: 'At $100K threshold', calculator: 'general', year: 2026, absenteeOwner: false, taxableValue: 100000, expectedTax: 975.00 },
  { scenario: 'Top of $100K-$300K bracket', calculator: 'general', year: 2026, absenteeOwner: false, taxableValue: 299999, expectedTax: 975.00 },
  { scenario: 'At $300K threshold', calculator: 'general', year: 2026, absenteeOwner: false, taxableValue: 300000, expectedTax: 1350.00 },
  { scenario: 'Top of $300K-$600K bracket', calculator: 'general', year: 2026, absenteeOwner: false, taxableValue: 599999, expectedTax: 2250.00 },
  { scenario: 'At $600K threshold', calculator: 'general', year: 2026, absenteeOwner: false, taxableValue: 600000, expectedTax: 2250.00 },
  { scenario: 'Top of $600K-$1M bracket', calculator: 'general', year: 2026, absenteeOwner: false, taxableValue: 999999, expectedTax: 4649.99 },
  { scenario: 'At $1M threshold', calculator: 'general', year: 2026, absenteeOwner: false, taxableValue: 1000000, expectedTax: 4650.00 },
  { scenario: 'Top of $1M-$1.8M bracket', calculator: 'general', year: 2026, absenteeOwner: false, taxableValue: 1799999, expectedTax: 11849.99 },
  { scenario: 'At $1.8M threshold', calculator: 'general', year: 2026, absenteeOwner: false, taxableValue: 1800000, expectedTax: 11850.00 },
  { scenario: 'Top of $1.8M-$3M bracket', calculator: 'general', year: 2026, absenteeOwner: false, taxableValue: 2999999, expectedTax: 31649.98 },
  { scenario: 'At $3M threshold', calculator: 'general', year: 2026, absenteeOwner: false, taxableValue: 3000000, expectedTax: 31650.00 },
  { scenario: 'Mid-range value ($5M)', calculator: 'general', year: 2026, absenteeOwner: false, taxableValue: 5000000, expectedTax: 84650.00 },

  // General rates with absentee owner surcharge
  { scenario: 'Below threshold (nil)', calculator: 'general', year: 2026, absenteeOwner: true, taxableValue: 0, expectedTax: 0.00 },
  { scenario: 'Just below $50K threshold', calculator: 'general', year: 2026, absenteeOwner: true, taxableValue: 49999, expectedTax: 0.00 },
  { scenario: 'At $50K threshold (entry)', calculator: 'general', year: 2026, absenteeOwner: true, taxableValue: 50000, expectedTax: 2500.00 },
  { scenario: 'Top of $50K-$100K bracket', calculator: 'general', year: 2026, absenteeOwner: true, taxableValue: 99999, expectedTax: 4499.96 },
  { scenario: 'At $100K threshold', calculator: 'general', year: 2026, absenteeOwner: true, taxableValue: 100000, expectedTax: 4975.00 },
  { scenario: 'Top of $100K-$300K bracket', calculator: 'general', year: 2026, absenteeOwner: true, taxableValue: 299999, expectedTax: 12974.96 },
  { scenario: 'At $300K threshold', calculator: 'general', year: 2026, absenteeOwner: true, taxableValue: 300000, expectedTax: 13350.00 },
  { scenario: 'Top of $300K-$600K bracket', calculator: 'general', year: 2026, absenteeOwner: true, taxableValue: 599999, expectedTax: 26249.96 },
  { scenario: 'At $600K threshold', calculator: 'general', year: 2026, absenteeOwner: true, taxableValue: 600000, expectedTax: 26250.00 },
  { scenario: 'Top of $600K-$1M bracket', calculator: 'general', year: 2026, absenteeOwner: true, taxableValue: 999999, expectedTax: 44649.95 },
  { scenario: 'At $1M threshold', calculator: 'general', year: 2026, absenteeOwner: true, taxableValue: 1000000, expectedTax: 44650.00 },
  { scenario: 'Top of $1M-$1.8M bracket', calculator: 'general', year: 2026, absenteeOwner: true, taxableValue: 1799999, expectedTax: 83849.95 },
  { scenario: 'At $1.8M threshold', calculator: 'general', year: 2026, absenteeOwner: true, taxableValue: 1800000, expectedTax: 83850.00 },
  { scenario: 'Top of $1.8M-$3M bracket', calculator: 'general', year: 2026, absenteeOwner: true, taxableValue: 2999999, expectedTax: 151649.94 },
  { scenario: 'At $3M threshold', calculator: 'general', year: 2026, absenteeOwner: true, taxableValue: 3000000, expectedTax: 151650.00 },
  { scenario: 'Mid-range value ($5M)', calculator: 'general', year: 2026, absenteeOwner: true, taxableValue: 5000000, expectedTax: 284650.00 },

  // Trust surcharge rates
  { scenario: 'Below trust threshold (nil)', calculator: 'trust', year: 2026, absenteeOwner: false, taxableValue: 0, expectedTax: 0.00 },
  { scenario: 'Just below $25K threshold', calculator: 'trust', year: 2026, absenteeOwner: false, taxableValue: 24999, expectedTax: 0.00 },
  { scenario: 'At $25K threshold (entry)', calculator: 'trust', year: 2026, absenteeOwner: false, taxableValue: 25000, expectedTax: 82.00 },
  { scenario: 'Top of $25K-$50K bracket', calculator: 'trust', year: 2026, absenteeOwner: false, taxableValue: 49999, expectedTax: 175.75 },
  { scenario: 'At $50K threshold', calculator: 'trust', year: 2026, absenteeOwner: false, taxableValue: 50000, expectedTax: 676.00 },
  { scenario: 'Top of $50K-$100K bracket', calculator: 'trust', year: 2026, absenteeOwner: false, taxableValue: 99999, expectedTax: 863.50 },
  { scenario: 'At $100K threshold', calculator: 'trust', year: 2026, absenteeOwner: false, taxableValue: 100000, expectedTax: 1338.00 },
  { scenario: 'Top of $100K-$250K bracket', calculator: 'trust', year: 2026, absenteeOwner: false, taxableValue: 249999, expectedTax: 1900.50 },
  { scenario: 'At $250K threshold', calculator: 'trust', year: 2026, absenteeOwner: false, taxableValue: 250000, expectedTax: 1901.00 },
  { scenario: 'Top of $250K-$600K bracket', calculator: 'trust', year: 2026, absenteeOwner: false, taxableValue: 599999, expectedTax: 4263.49 },
  { scenario: 'At $600K threshold', calculator: 'trust', year: 2026, absenteeOwner: false, taxableValue: 600000, expectedTax: 4263.00 },
  { scenario: 'Top of $600K-$1M bracket', calculator: 'trust', year: 2026, absenteeOwner: false, taxableValue: 999999, expectedTax: 8162.99 },
  { scenario: 'At $1M threshold', calculator: 'trust', year: 2026, absenteeOwner: false, taxableValue: 1000000, expectedTax: 8163.00 },
  { scenario: 'Top of $1M-$1.8M bracket', calculator: 'trust', year: 2026, absenteeOwner: false, taxableValue: 1799999, expectedTax: 18362.99 },
  { scenario: 'At $1.8M threshold', calculator: 'trust', year: 2026, absenteeOwner: false, taxableValue: 1800000, expectedTax: 18363.00 },
  { scenario: 'Top of $1.8M-$3M bracket', calculator: 'trust', year: 2026, absenteeOwner: false, taxableValue: 2999999, expectedTax: 31649.39 },
  { scenario: 'At $3M threshold', calculator: 'trust', year: 2026, absenteeOwner: false, taxableValue: 3000000, expectedTax: 31650.00 },
  { scenario: 'Mid-range value ($5M)', calculator: 'trust', year: 2026, absenteeOwner: false, taxableValue: 5000000, expectedTax: 84650.00 },

  // Trust surcharge rates with absentee owner
  { scenario: 'Below trust threshold (nil)', calculator: 'trust', year: 2026, absenteeOwner: true, taxableValue: 0, expectedTax: 0.00 },
  { scenario: 'Just below $25K threshold', calculator: 'trust', year: 2026, absenteeOwner: true, taxableValue: 24999, expectedTax: 0.00 },
  { scenario: 'At $25K threshold (entry)', calculator: 'trust', year: 2026, absenteeOwner: true, taxableValue: 25000, expectedTax: 1082.00 },
  { scenario: 'Top of $25K-$50K bracket', calculator: 'trust', year: 2026, absenteeOwner: true, taxableValue: 49999, expectedTax: 2175.71 },
  { scenario: 'At $50K threshold', calculator: 'trust', year: 2026, absenteeOwner: true, taxableValue: 50000, expectedTax: 2676.00 },
  { scenario: 'Top of $50K-$100K bracket', calculator: 'trust', year: 2026, absenteeOwner: true, taxableValue: 99999, expectedTax: 4863.46 },
  { scenario: 'At $100K threshold', calculator: 'trust', year: 2026, absenteeOwner: true, taxableValue: 100000, expectedTax: 5338.00 },
  { scenario: 'Top of $100K-$250K bracket', calculator: 'trust', year: 2026, absenteeOwner: true, taxableValue: 249999, expectedTax: 11900.46 },
  { scenario: 'At $250K threshold', calculator: 'trust', year: 2026, absenteeOwner: true, taxableValue: 250000, expectedTax: 11901.00 },
  { scenario: 'Top of $250K-$600K bracket', calculator: 'trust', year: 2026, absenteeOwner: true, taxableValue: 599999, expectedTax: 28263.45 },
  { scenario: 'At $600K threshold', calculator: 'trust', year: 2026, absenteeOwner: true, taxableValue: 600000, expectedTax: 28263.00 },
  { scenario: 'Top of $600K-$1M bracket', calculator: 'trust', year: 2026, absenteeOwner: true, taxableValue: 999999, expectedTax: 48162.95 },
  { scenario: 'At $1M threshold', calculator: 'trust', year: 2026, absenteeOwner: true, taxableValue: 1000000, expectedTax: 48163.00 },
  { scenario: 'Top of $1M-$1.8M bracket', calculator: 'trust', year: 2026, absenteeOwner: true, taxableValue: 1799999, expectedTax: 90362.95 },
  { scenario: 'At $1.8M threshold', calculator: 'trust', year: 2026, absenteeOwner: true, taxableValue: 1800000, expectedTax: 90363.00 },
  { scenario: 'Top of $1.8M-$3M bracket', calculator: 'trust', year: 2026, absenteeOwner: true, taxableValue: 2999999, expectedTax: 151649.35 },
  { scenario: 'At $3M threshold', calculator: 'trust', year: 2026, absenteeOwner: true, taxableValue: 3000000, expectedTax: 151650.00 },
  { scenario: 'Mid-range value ($5M)', calculator: 'trust', year: 2026, absenteeOwner: true, taxableValue: 5000000, expectedTax: 284650.00 },
];
