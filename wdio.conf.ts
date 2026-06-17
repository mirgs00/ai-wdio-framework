import { execSync, spawn, type ChildProcess } from 'child_process';

// I-05: typed as ChildProcess | null instead of any
let ollamaProcess: ChildProcess | null = null;

export const config: WebdriverIO.Config = {
  //
  // ====================
  // Runner Configuration
  // ====================
  runner: 'local',
  tsConfigPath: './tsconfig.json',

  //
  // ==================
  // Specify Test Files
  // ==================
  specs: ['./src/features/**/*.feature'],
  exclude: [],

  //
  // ============
  // Capabilities
  // ============
  // I-11: maxInstances driven from env so local dev and CI can use different values.
  // Default to 1 locally; set WDIO_MAX_INSTANCES=5 (or higher) in CI.
  maxInstances: parseInt(process.env.WDIO_MAX_INSTANCES ?? '1', 10),

  capabilities: [
    {
      browserName: 'firefox',
      // 'moz:firefoxOptions': {
        // args: ['-headless'],
      // },
    },
  ],

  //
  // ===================
  // Test Configurations
  // ===================
  logLevel: 'error',
  bail: 0,
  baseUrl: process.env.BASE_URL || 'https://practicetestautomation.com',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  services: [],

  framework: 'cucumber',
  specFileRetries: 0,
  reporters: ['spec'],

  cucumberOpts: {
    require: ['./src/step-definitions/**/*.ts'],
    backtrace: false,
    requireModule: [],
    dryRun: false,
    failFast: false,
    name: [],
    snippets: true,
    source: true,
    strict: false,
    tagExpression: '',
    timeout: 60000,
    ignoreUndefinedDefinitions: false,
  },

  //
  // =====
  // Hooks
  // =====

  /**
   * Gets executed once before all workers get launched.
   * Starts Ollama if it is not already running (unless SKIP_OLLAMA_CHECK=true).
   */
  onPrepare: async function (_config, _capabilities) {
    // I-14: allow CI environments where Ollama is pre-started to skip this check
    if (process.env.SKIP_OLLAMA_CHECK === 'true') {
      console.log('\n⏭  SKIP_OLLAMA_CHECK=true — skipping Ollama lifecycle management');
      return;
    }

    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

    // I-06: use native fetch (Node 18+) — node-fetch import removed
    async function isOllamaHealthy(): Promise<boolean> {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(`${ollamaUrl}/api/tags`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response.ok;
      } catch {
        return false;
      }
    }

    async function startOllama(): Promise<boolean> {
      try {
        const platform = process.platform;
        const command = 'ollama';

        if (platform === 'win32') {
          try {
            execSync('where ollama', { stdio: 'ignore' });
          } catch {
            throw new Error('Ollama not found in PATH');
          }
        } else {
          try {
            execSync('which ollama', { stdio: 'ignore' });
          } catch {
            throw new Error('Ollama not found');
          }
        }

        console.log('\n📦 Starting Ollama service...');
        ollamaProcess = spawn(command, ['serve'], {
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: false,
        });

        ollamaProcess.stderr?.on('data', (data: Buffer) => {
          const msg = data.toString().trim();
          if (msg && (msg.includes('ERROR') || msg.includes('WARN'))) {
            console.log(` [Ollama] ${msg}`);
          }
        });

        const maxRetries = 10;
        const retryInterval = 2000;

        for (let attempts = 0; attempts < maxRetries; attempts++) {
          if (await isOllamaHealthy()) {
            console.log(`✅ Ollama service started and ready`);
            return true;
          }
          if (attempts < maxRetries - 1) {
            await new Promise<void>(resolve => setTimeout(resolve, retryInterval));
          }
        }

        console.error('❌ Ollama did not start within timeout');
        return false;
      } catch (error) {
        console.warn('⚠️  Could not start Ollama:', error instanceof Error ? error.message : error);
        return false;
      }
    }

    console.log(`\n🔍 Checking Ollama service at ${ollamaUrl}...`);
    const isHealthy = await isOllamaHealthy();

    if (isHealthy) {
      console.log('✅ Ollama health check PASSED — AI features enabled');
    } else {
      console.warn('⚠️  Ollama is not responding. Attempting to start...');
      const started = await startOllama();
      if (!started) {
        console.warn('\n⚠️  AI-powered step generation will use fallback implementations');
      }
    }
  },

  onComplete: async function (_exitCode, _config, _capabilities, _results) {
    if (ollamaProcess) {
      try {
        ollamaProcess.kill('SIGTERM');
        await new Promise<void>(resolve => setTimeout(resolve, 1000));
        if (!ollamaProcess.killed) {
          ollamaProcess.kill('SIGKILL');
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  },

  before: function (_capabilities, _specs) {
    require('./src/commands/healableFind');
  },
};
