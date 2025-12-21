import { execSync } from 'child_process';
import { existsSync } from 'fs';

export function validateEnvironment(): void {
  console.log('🔍 Validating environment...');

  try {
    execSync('npx wdio --version', { stdio: 'ignore' });
    console.log('✅ WebdriverIO found (local)');
  } catch {
    try {
      execSync('wdio --version', { stdio: 'ignore' });
      console.log('✅ WebdriverIO found (global)');
    } catch {
      throw new Error(
        'WebdriverIO not found. Please install with: npm install --save-dev @wdio/cli'
      );
    }
  }

  try {
    execSync('npx ts-node --version', { stdio: 'ignore' });
    console.log('✅ ts-node found (local)');
  } catch {
    try {
      execSync('ts-node --version', { stdio: 'ignore' });
      console.log('✅ ts-node found (global)');
    } catch {
      throw new Error('ts-node not found. Please install with: npm install --save-dev ts-node');
    }
  }

  if (!existsSync('./wdio.conf.ts')) {
    throw new Error('WebdriverIO config (wdio.conf.ts) not found in project root.');
  }

  console.log('✅ Environment validation passed');
}
