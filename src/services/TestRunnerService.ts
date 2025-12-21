import { execSync } from 'child_process';
import * as path from 'path';
import { TIMEOUTS } from '../utils/constants';

export class TestRunnerService {
  runTests(featureFilePath: string, timeout: number = TIMEOUTS.DEFAULT_TEST_TIMEOUT): void {
    try {
      console.log('\n🧪 Running generated tests...');
      const absFeaturePath = path.resolve(featureFilePath);

      const wdioCommand = [
        'npx wdio run ./wdio.conf.ts',
        `--spec ${absFeaturePath}`,
        `--mochaOpts.timeout ${timeout}`,
        '--specFileRetries 1',
      ].join(' ');

      console.log(`🚀 Test command: ${wdioCommand}`);
      execSync(wdioCommand, { stdio: 'inherit' });
      console.log('✅ Tests completed successfully!');
    } catch (error) {
      console.error('❌ Test execution failed:', error instanceof Error ? error.message : error);
      throw error;
    }
  }
}
