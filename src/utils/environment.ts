import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { logger } from './logger';

export function validateEnvironment(): void {
  logger.info('Validating environment...');

  try {
    execSync('npx wdio --version', { stdio: 'ignore' });
    logger.info('WebdriverIO found (local)');
  } catch {
    try {
      execSync('wdio --version', { stdio: 'ignore' });
      logger.info('WebdriverIO found (global)');
    } catch {
      throw new Error(
        'WebdriverIO not found. Please install with: npm install --save-dev @wdio/cli'
      );
    }
  }

  try {
    execSync('npx ts-node --version', { stdio: 'ignore' });
    logger.info('ts-node found (local)');
  } catch {
    try {
      execSync('ts-node --version', { stdio: 'ignore' });
      logger.info('ts-node found (global)');
    } catch {
      throw new Error('ts-node not found. Please install with: npm install --save-dev ts-node');
    }
  }

  if (!existsSync('./wdio.conf.ts')) {
    throw new Error('WebdriverIO config (wdio.conf.ts) not found in project root.');
  }

  logger.info('Environment validation passed');
}
