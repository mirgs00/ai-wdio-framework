import { writeFileSync, readFileSync, existsSync } from 'fs';
import * as path from 'path';

export interface FailedTest {
  scenario: string;
  featureName: string;
  error?: string;
  timestamp: number;
}

export interface FailureReport {
  totalTests: number;
  failedTests: number;
  passedTests: number;
  failures: FailedTest[];
  lastRunTime: number;
}

const FAILURE_TRACKING_FILE = path.resolve('test-failures.json');

export class TestFailureTracker {
  static recordFailure(scenario: string, featureName: string, error?: string): void {
    const report = this.loadReport();
    
    const failure: FailedTest = {
      scenario,
      featureName,
      error,
      timestamp: Date.now()
    };

    const existingIndex = report.failures.findIndex(
      f => f.scenario === scenario && f.featureName === featureName
    );

    if (existingIndex >= 0) {
      report.failures[existingIndex] = failure;
    } else {
      report.failures.push(failure);
    }

    report.lastRunTime = Date.now();
    this.saveReport(report);
  }

  static recordTestResults(total: number, passed: number, failed: number): void {
    const report = this.loadReport();
    report.totalTests = total;
    report.passedTests = passed;
    report.failedTests = failed;
    report.lastRunTime = Date.now();
    this.saveReport(report);
  }

  static getFailedTests(): FailedTest[] {
    const report = this.loadReport();
    return report.failures;
  }

  static getFailureReport(): FailureReport {
    return this.loadReport();
  }

  static clearFailures(): void {
    const report: FailureReport = {
      totalTests: 0,
      failedTests: 0,
      passedTests: 0,
      failures: [],
      lastRunTime: 0
    };
    this.saveReport(report);
  }

  static hasFailures(): boolean {
    const report = this.loadReport();
    return report.failures.length > 0;
  }

  private static loadReport(): FailureReport {
    if (existsSync(FAILURE_TRACKING_FILE)) {
      try {
        const content = readFileSync(FAILURE_TRACKING_FILE, 'utf-8');
        return JSON.parse(content);
      } catch {
        return this.getEmptyReport();
      }
    }
    return this.getEmptyReport();
  }

  private static saveReport(report: FailureReport): void {
    writeFileSync(FAILURE_TRACKING_FILE, JSON.stringify(report, null, 2));
  }

  private static getEmptyReport(): FailureReport {
    return {
      totalTests: 0,
      failedTests: 0,
      passedTests: 0,
      failures: [],
      lastRunTime: 0
    };
  }
}
