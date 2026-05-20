import { execSync } from 'child_process';
import * as path from 'path';
import { quote } from 'shell-quote';
import { TIMEOUTS } from '../utils/constants';

export class TestRunnerService {
  runTests(featureFilePath: string, timeout: number = TIMEOUTS.DEFAULT_TEST_TIMEOUT): void {
    try {
      console.log('\n🧪 Running generated tests...');
      const absFeaturePath = path.resolve(featureFilePath);

      const wdioArgs = [
        'run', './wdio.conf.ts',
        '--spec', absFeaturePath,
        '--mochaOpts.timeout', String(timeout),
        '--specFileRetries', '1',
      ];

      console.log(`🚀 Test command: npx wdio ${wdioArgs.join(' ')}`);
      execSync(`npx wdio ${quote(wdioArgs)}`, { stdio: 'inherit' });
      console.log('✅ Tests completed successfully!');
    } catch (error) {
      console.error('❌ Test execution failed:', error instanceof Error ? error.message : error);
      throw error;
    }
  }
}
