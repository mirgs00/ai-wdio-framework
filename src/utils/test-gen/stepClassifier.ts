type StepType = 'Given' | 'When' | 'Then' | 'And';

const GIVEN_KEYWORDS = ['navigate', 'open', 'visit', 'on the page', 'on the login'];
const THEN_KEYWORDS = ['should', 'verify', 'expect', 'see', 'error message'];
const AND_KEYWORDS = ['remain'];

export function determineStepType(step: string): StepType {
  const lowerStep = step.toLowerCase();

  if (GIVEN_KEYWORDS.some((kw) => lowerStep.includes(kw))) {
    return 'Given';
  }

  if (THEN_KEYWORDS.some((kw) => lowerStep.includes(kw))) {
    return 'Then';
  }

  if (AND_KEYWORDS.some((kw) => lowerStep.includes(kw))) {
    return 'And';
  }

  return 'When';
}
