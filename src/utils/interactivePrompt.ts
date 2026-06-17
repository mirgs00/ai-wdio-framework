import * as readline from 'readline';

export interface InteractiveConfig {
  url: string;
  instruction: string;
  model: string;
  runTests: boolean;
  maxDepth: number;
  maxStates: number;
  smokeOnly: boolean;
}

export async function promptForConfig(): Promise<InteractiveConfig> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, resolve));

  try {
    console.log('\n🤖 AI-WDIO Interactive Test Generator\n');

    const url = await ask('Enter the URL to test: ');
    if (!url.trim()) {
      throw new Error('URL is required');
    }

    const instruction = await ask('Describe what to test (optional, press Enter to skip): ');
    const model = (await ask('Ollama model [llama3]: ')).trim() || 'llama3';
    const runTestsInput = (await ask('Run tests after generation? [Y/n]: ')).trim().toLowerCase();
    const runTests = runTestsInput !== 'n';
    const maxDepthInput = (await ask('Max exploration depth [3]: ')).trim();
    const maxDepth = parseInt(maxDepthInput, 10) || 3;
    const maxStatesInput = (await ask('Max states to discover [20]: ')).trim();
    const maxStates = parseInt(maxStatesInput, 10) || 20;
    const smokeOnlyInput = (await ask('Generate smoke tests only? [y/N]: ')).trim().toLowerCase();
    const smokeOnly = smokeOnlyInput === 'y';

    return { url: url.trim(), instruction: instruction.trim(), model, runTests, maxDepth, maxStates, smokeOnly };
  } finally {
    rl.close();
  }
}
