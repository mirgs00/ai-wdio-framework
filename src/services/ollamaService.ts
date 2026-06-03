import { execSync, spawn, type ChildProcess } from 'child_process';
import fetch from 'node-fetch';
import { getConfig } from '../config';
import { logger } from '../utils/logger';

/**
 * WebdriverIO Service for Ollama AI
 * Automatically checks and starts Ollama service before tests run
 */
export class OllamaService {
  private ollamaProcess: ChildProcess | null = null;
  private ollamaStdoutListener: ((data: Buffer) => void) | null = null;
  private ollamaStderrListener: ((data: Buffer) => void) | null = null;
  private readonly OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  private readonly HEALTH_CHECK_ENDPOINT = `${this.OLLAMA_URL}/api/tags`;
  private readonly HEALTH_CHECK_TIMEOUT = 5000;
  private readonly START_TIMEOUT = 30000;
  private readonly MAX_RETRIES = 10;
  private readonly RETRY_INTERVAL = 2000;

  async onPrepare() {
    logger.info('\n🤖 Ollama Service: Preparing...');
    await this.ensureOllamaRunning();
  }

  async onComplete() {
    logger.info('\n🤖 Ollama Service: Cleaning up...');
    if (this.ollamaProcess) {
      // Clean up stream listeners to prevent memory leaks
      if (this.ollamaStdoutListener && this.ollamaProcess.stdout) {
        this.ollamaProcess.stdout.removeListener('data', this.ollamaStdoutListener);
      }
      if (this.ollamaStderrListener && this.ollamaProcess.stderr) {
        this.ollamaProcess.stderr.removeListener('data', this.ollamaStderrListener);
      }
      try {
        logger.info('🛑 Stopping Ollama service...');
        this.ollamaProcess.kill('SIGTERM');

        // Give it a moment to shut down gracefully
        await new Promise((resolve) => setTimeout(resolve, 2000));

        if (!this.ollamaProcess.killed) {
          this.ollamaProcess.kill('SIGKILL');
        }
        logger.info('✅ Ollama service stopped');
      } catch (error) {
        logger.warn('⚠️ Error stopping Ollama');
      }
    }
  }

  private async isOllamaHealthy(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.HEALTH_CHECK_TIMEOUT);

      const response = await fetch(this.HEALTH_CHECK_ENDPOINT, {
        signal: controller.signal as AbortSignal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  private getOllamaCommand(): string {
    const platform = process.platform;

    if (platform === 'win32') {
      // Windows: try to find ollama.exe
      try {
        execSync('where ollama', { stdio: 'ignore' });
        return 'ollama';
      } catch {
        throw new Error('Ollama not found in PATH. Please install Ollama from https://ollama.ai');
      }
    } else if (platform === 'darwin') {
      // macOS: typically in /usr/local/bin or /opt/homebrew/bin
      try {
        execSync('which ollama', { stdio: 'ignore' });
        return 'ollama';
      } catch {
        throw new Error('Ollama not found. Please install Ollama from https://ollama.ai');
      }
    } else if (platform === 'linux') {
      // Linux: typically in /usr/local/bin
      try {
        execSync('which ollama', { stdio: 'ignore' });
        return 'ollama';
      } catch {
        throw new Error('Ollama not found. Please install Ollama from https://ollama.ai');
      }
    }

    throw new Error(`Unsupported platform: ${platform}`);
  }

  private async startOllama(): Promise<boolean> {
    try {
      const command = this.getOllamaCommand();

      logger.info(`\n📦 Starting Ollama service...`);
      logger.info(`   Command: ${command} serve`);
      logger.info(`   URL: ${this.OLLAMA_URL}`);

      this.ollamaProcess = spawn(command, ['serve'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      // Log Ollama output
      this.ollamaStdoutListener = (data: Buffer) => {
        const message = data.toString().trim();
        if (message && !message.includes('listening on')) {
          // Only log relevant messages, not every line
          if (message.includes('ERROR') || message.includes('WARN')) {
            logger.info(`   [Ollama] ${message}`);
          }
        }
      };
      this.ollamaProcess.stdout?.on('data', this.ollamaStdoutListener);

      this.ollamaStderrListener = (data: Buffer) => {
        const message = data.toString().trim();
        if (message) {
          logger.warn(`   [Ollama] ${message}`);
        }
      };
      this.ollamaProcess.stderr?.on('data', this.ollamaStderrListener);

      this.ollamaProcess.on('error', (error: Error) => {
        logger.error(`❌ Failed to start Ollama: ${error.message}`);
      });

      // Wait for Ollama to be ready
      logger.info(`   Waiting for service to be ready...`);
      return await this.waitForOllamaReady();
    } catch (error) {
      logger.error(`❌ Error starting Ollama: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }

  private async waitForOllamaReady(): Promise<boolean> {
    let attempts = 0;

    while (attempts < this.MAX_RETRIES) {
      try {
        const isHealthy = await this.isOllamaHealthy();

        if (isHealthy) {
          logger.info(`✅ Ollama service is ready after ${(attempts + 1) * this.RETRY_INTERVAL}ms`);
          return true;
        }
      } catch (error) {
        // Continue retrying
      }

      attempts++;

      if (attempts < this.MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, this.RETRY_INTERVAL));
      }
    }

    logger.error(
      `❌ Ollama service did not become ready after ${this.MAX_RETRIES * this.RETRY_INTERVAL}ms`
    );
    return false;
  }

  private async ensureOllamaRunning(): Promise<void> {
    const config = getConfig();

    if (config.ollama.disabled) {
      logger.warn('⚠️  Ollama AI features are disabled (OLLAMA_DISABLE=true)');
      return;
    }

    logger.info(`🔍 Checking Ollama service at ${this.OLLAMA_URL}...`);

    const isHealthy = await this.isOllamaHealthy();

    if (isHealthy) {
      logger.info('✅ Ollama service is already running');
      return;
    }

    logger.warn('⚠️  Ollama service is not responding. Attempting to start...');

    const startSuccess = await this.startOllama();

    if (!startSuccess) {
      logger.warn('\n⚠️  ═══════════════════════════════════════════════════════════════');
      logger.warn('⚠️  WARNING: Could not start Ollama service');
      logger.warn('⚠️  ═══════════════════════════════════════════════════════════════');
      logger.warn('⚠️  Tests will run but AI-powered features will be disabled');
      logger.warn('⚠️  ');
      logger.warn('⚠️  To manually start Ollama:');
      logger.warn('⚠️    npm run ollama:start');
      logger.warn('⚠️  ');
      logger.warn('⚠️  To install Ollama:');
      logger.warn('⚠️    https://ollama.ai');
      logger.warn('⚠️  ═══════════════════════════════════════════════════════════════\n');
    }
  }
}

export default OllamaService;
