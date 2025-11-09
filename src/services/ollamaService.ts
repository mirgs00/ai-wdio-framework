import { execSync, spawn } from 'child_process';
import fetch from 'node-fetch';

/**
 * WebdriverIO Service for Ollama AI
 * Automatically checks and starts Ollama service before tests run
 */
export class OllamaService {
  private ollamaProcess: any = null;
  private readonly OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  private readonly HEALTH_CHECK_ENDPOINT = `${this.OLLAMA_URL}/api/tags`;
  private readonly HEALTH_CHECK_TIMEOUT = 5000;
  private readonly START_TIMEOUT = 30000;
  private readonly MAX_RETRIES = 10;
  private readonly RETRY_INTERVAL = 2000;

  async onPrepare() {
    console.log('\n🤖 Ollama Service: Preparing...');
    await this.ensureOllamaRunning();
  }

  async onComplete() {
    console.log('\n🤖 Ollama Service: Cleaning up...');
    if (this.ollamaProcess) {
      try {
        console.log('🛑 Stopping Ollama service...');
        this.ollamaProcess.kill('SIGTERM');

        // Give it a moment to shut down gracefully
        await new Promise((resolve) => setTimeout(resolve, 2000));

        if (!this.ollamaProcess.killed) {
          this.ollamaProcess.kill('SIGKILL');
        }
        console.log('✅ Ollama service stopped');
      } catch (error) {
        console.warn('⚠️ Error stopping Ollama:', error instanceof Error ? error.message : error);
      }
    }
  }

  private async isOllamaHealthy(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.HEALTH_CHECK_TIMEOUT);

      const response = await fetch(this.HEALTH_CHECK_ENDPOINT, {
        signal: controller.signal as any,
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

      console.log(`\n📦 Starting Ollama service...`);
      console.log(`   Command: ${command} serve`);
      console.log(`   URL: ${this.OLLAMA_URL}`);

      this.ollamaProcess = spawn(command, ['serve'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      // Log Ollama output
      this.ollamaProcess.stdout?.on('data', (data: Buffer) => {
        const message = data.toString().trim();
        if (message && !message.includes('listening on')) {
          // Only log relevant messages, not every line
          if (message.includes('ERROR') || message.includes('WARN')) {
            console.log(`   [Ollama] ${message}`);
          }
        }
      });

      this.ollamaProcess.stderr?.on('data', (data: Buffer) => {
        const message = data.toString().trim();
        if (message) {
          console.warn(`   [Ollama] ${message}`);
        }
      });

      this.ollamaProcess.on('error', (error: Error) => {
        console.error(`❌ Failed to start Ollama: ${error.message}`);
      });

      // Wait for Ollama to be ready
      console.log(`   Waiting for service to be ready...`);
      return await this.waitForOllamaReady();
    } catch (error) {
      console.error(`❌ Error starting Ollama: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }

  private async waitForOllamaReady(): Promise<boolean> {
    let attempts = 0;

    while (attempts < this.MAX_RETRIES) {
      try {
        const isHealthy = await this.isOllamaHealthy();

        if (isHealthy) {
          console.log(`✅ Ollama service is ready after ${(attempts + 1) * this.RETRY_INTERVAL}ms`);
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

    console.error(
      `❌ Ollama service did not become ready after ${this.MAX_RETRIES * this.RETRY_INTERVAL}ms`
    );
    return false;
  }

  private async ensureOllamaRunning(): Promise<void> {
    console.log(`🔍 Checking Ollama service at ${this.OLLAMA_URL}...`);

    const isHealthy = await this.isOllamaHealthy();

    if (isHealthy) {
      console.log('✅ Ollama service is already running');
      return;
    }

    console.warn('⚠️  Ollama service is not responding. Attempting to start...');

    const startSuccess = await this.startOllama();

    if (!startSuccess) {
      console.warn('\n⚠️  ═══════════════════════════════════════════════════════════════');
      console.warn('⚠️  WARNING: Could not start Ollama service');
      console.warn('⚠️  ═══════════════════════════════════════════════════════════════');
      console.warn('⚠️  Tests will run but AI-powered features will be disabled');
      console.warn('⚠️  ');
      console.warn('⚠️  To manually start Ollama:');
      console.warn('⚠️    npm run ollama:start');
      console.warn('⚠️  ');
      console.warn('⚠️  To install Ollama:');
      console.warn('⚠️    https://ollama.ai');
      console.warn('⚠️  ═══════════════════════════════════════════════════════════════\n');
    }
  }
}

export default OllamaService;
