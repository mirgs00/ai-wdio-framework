import { extractScenarios } from '../../src/utils/flow-matrix/scenarioExtractor';
import { FlowMatrix, StateNode } from '../../src/utils/flow-matrix/types';

function createMockMatrix(overrides: Partial<FlowMatrix> = {}): FlowMatrix {
  const startState: StateNode = {
    id: 'start',
    url: 'https://example.com',
    title: 'Home',
    pageType: 'home',
    fingerprint: 'home-fp',
    elements: [
      {
        tag: 'a',
        selector: '#login-link',
        type: 'link',
        name: 'Login',
        text: 'Login',
        attributes: { href: '/login' },
        isButton: false,
        isLink: true,
        isInput: false,
        isForm: false,
        isSelect: false,
      },
    ],
  };

  const loginState: StateNode = {
    id: 'login',
    url: 'https://example.com/login',
    title: 'Login',
    pageType: 'login',
    fingerprint: 'login-fp',
    elements: [
      {
        tag: 'input',
        selector: '#username',
        type: 'text',
        name: 'username',
        attributes: {},
        isButton: false,
        isLink: false,
        isInput: true,
        isForm: false,
        isSelect: false,
      },
      {
        tag: 'input',
        selector: '#password',
        type: 'password',
        name: 'password',
        attributes: {},
        isButton: false,
        isLink: false,
        isInput: true,
        isForm: false,
        isSelect: false,
      },
      {
        tag: 'button',
        selector: '#submit',
        type: 'submit',
        name: 'Submit',
        text: 'Submit',
        attributes: {},
        isButton: true,
        isLink: false,
        isInput: false,
        isForm: false,
        isSelect: false,
      },
    ],
  };

  return {
    rootUrl: 'https://example.com',
    states: new Map([
      ['start', startState],
      ['login', loginState],
    ]),
    transitions: [
      {
        from: 'start',
        to: 'login',
        interaction: {
          type: 'click',
          selector: '#login-link',
          description: 'Click Login',
        },
      },
      {
        from: 'login',
        to: 'login',
        interaction: {
          type: 'submit',
          selector: 'form',
          description: 'Submit login form',
        },
        data: {
          '#username': 'student',
          '#password': 'Password123',
        },
      },
    ],
    startStateId: 'start',
    ...overrides,
  };
}

describe('scenarioExtractor', () => {
  it('extracts scenarios from flow matrix', () => {
    const matrix = createMockMatrix();
    const scenarios = extractScenarios(matrix);

    expect(scenarios.length).toBeGreaterThan(0);
    expect(scenarios.some((s) => s.tags.includes('@discovered'))).toBe(true);
  });

  it('generates smoke tests', () => {
    const matrix = createMockMatrix();
    const scenarios = extractScenarios(matrix);

    const smokeTests = scenarios.filter((s) => s.tags.includes('@smoke'));
    expect(smokeTests.length).toBeGreaterThan(0);
    expect(smokeTests.some((s) => s.name.includes('Homepage loads'))).toBe(true);
  });

  it('generates negative test scenarios for forms', () => {
    const matrix = createMockMatrix();
    const scenarios = extractScenarios(matrix);

    const negativeTests = scenarios.filter((s) => s.tags.includes('@negative'));
    expect(negativeTests.length).toBeGreaterThan(0);
    expect(negativeTests.some((s) => s.name.includes('empty form submission'))).toBe(true);
  });

  it('generates negative tests for email fields', () => {
    const matrix = createMockMatrix();
    const scenarios = extractScenarios(matrix);

    const emailTests = scenarios.filter(
      (s) => s.tags.includes('@negative') && s.name.includes('invalid email')
    );
    expect(emailTests.length).toBe(0); // No email field in mock
  });

  it('generates parameterized scenarios for login pages', () => {
    const matrix = createMockMatrix();
    const scenarios = extractScenarios(matrix);

    const parameterizedTests = scenarios.filter((s) => s.tags.includes('@parameterized'));
    expect(parameterizedTests.length).toBeGreaterThan(0);
    expect(parameterizedTests.some((s) => s.name.includes('various credentials'))).toBe(true);
  });

  it('deduplicates scenarios', () => {
    const matrix = createMockMatrix();
    const scenarios = extractScenarios(matrix);

    const names = scenarios.map((s) => s.name);
    const uniqueNames = new Set(names);
    expect(names.length).toBe(uniqueNames.size);
  });

  it('filters to smoke only when smokeOnly is set', () => {
    const matrix = createMockMatrix();
    const scenarios = extractScenarios(matrix, { smokeOnly: true });

    expect(scenarios.every((s) => s.tags.includes('@smoke'))).toBe(true);
  });
});
