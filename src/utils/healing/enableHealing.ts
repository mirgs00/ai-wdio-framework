/**
 * Enable Self-Healing Features
 *
 * This module enables the self-healing system for test automation.
 *
 * Usage in wdio.conf.ts:
 *
 * import { enableHealing } from './src/utils/healing/enableHealing';
 *
 * export const config: WebdriverIO.Config = {
 *   // ... other config
 *   before: function() {
 *     enableHealing();
 *     require('ts-node').register({ files: true });
 *   }
 * };
 *
 * Features:
 * - Automatic DOM scanning on step failure
 * - AI-powered selector regeneration using Ollama
 * - Automatic file updates for selectors and steps
 * - Retry mechanism with infinite loop protection
 * - Fallback healing when Ollama is offline
 *
 * Configuration via Environment Variables:
 * - OLLAMA_BASE_URL: Ollama service URL (default: http://localhost:11434)
 * - OLLAMA_MODEL: Model to use (default: llama3)
 * - OLLAMA_TIMEOUT: Timeout in ms (default: 120000)
 * - OLLAMA_MAX_RETRIES: Max retry attempts (default: 3)
 *
 * Example with all step types healed:
 *
 * When(/^user enters "([^"]*)" in field "([^"]*)"$/, async function(value, field) {
 *   return wrapStep(
 *     async () => {
 *       await pageContextManager.getCurrentPage()[field].setValue(value);
 *     },
 *     `user enters "${value}" in field "${field}"`,
 *     { maxRetries: 2 }
 *   );
 * });
 */

import { setupHealingHooks } from './healingHooks';

export function enableHealing(): void {
  console.log('🔧 Enabling AI-powered self-healing system...');

  try {
    setupHealingHooks();
    console.log('✅ Self-healing system initialized successfully');
    console.log('📊 Features enabled:');
    console.log('   - Automatic DOM scanning on failure');
    console.log('   - Ollama-powered selector regeneration');
    console.log('   - Auto file updates for page objects');
    console.log('   - Intelligent retry with loop protection');
  } catch (error) {
    console.warn(
      '⚠️ Self-healing initialization error:',
      error instanceof Error ? error.message : error
    );
  }
}

export { setupHealingHooks, wrapStep } from './healingHooks';
export { selfHealingService } from './selfHealingService';
