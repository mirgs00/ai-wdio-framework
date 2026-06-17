import { determineStepType } from '../../src/utils/test-gen/stepClassifier';

describe('stepClassifier', () => {
  describe('determineStepType', () => {
    it('classifies Given steps', () => {
      expect(determineStepType('I navigate to the login page')).toBe('Given');
      expect(determineStepType('open the homepage')).toBe('Given');
      expect(determineStepType('visit the dashboard')).toBe('Given');
      expect(determineStepType('the user is on the page')).toBe('Given');
      expect(determineStepType('the user is on the login page')).toBe('Given');
    });

    it('classifies Then steps', () => {
      expect(determineStepType('I should see the error message')).toBe('Then');
      expect(determineStepType('verify the page title')).toBe('Then');
      expect(determineStepType('expect the URL to change')).toBe('Then');
      expect(determineStepType('the user should see "Welcome"')).toBe('Then');
      expect(determineStepType('the error message should be displayed')).toBe('Then');
    });

    it('classifies And steps', () => {
      expect(determineStepType('the form remains unchanged')).toBe('And');
    });

    it('classifies When steps (default)', () => {
      expect(determineStepType('I click the submit button')).toBe('When');
      expect(determineStepType('fill in the username field')).toBe('When');
      expect(determineStepType('the user enters "test" in the search box')).toBe('When');
      expect(determineStepType('submit the form')).toBe('When');
    });

    it('handles case-insensitive matching', () => {
      expect(determineStepType('NAVIGATE to the page')).toBe('Given');
      expect(determineStepType('SHOULD see the error')).toBe('Then');
      expect(determineStepType('CLICK the button')).toBe('When');
    });
  });
});
