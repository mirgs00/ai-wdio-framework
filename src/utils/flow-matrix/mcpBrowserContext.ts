import { browser } from '@wdio/globals';
import type { BrowserElementInfo, AccessibilityNode } from '@wdio/mcp/snapshot';
import type { BrowserContext } from './interactionEngine';
import { logger } from '../logger';

// Dynamic import for ESM-only @wdio/mcp/snapshot
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mcpSnapshot: any = null;
async function loadMCPSnapshot(): Promise<boolean> {
  if (mcpSnapshot) return true;
  try {
    mcpSnapshot = await import('@wdio/mcp/snapshot');
    return true;
  } catch {
    return false;
  }
}

export class MCPBrowserContext implements BrowserContext {
  private mcpAvailable = false;

  constructor() {
    this.checkMCPAvailability();
  }

  private async checkMCPAvailability(): Promise<void> {
    try {
      const loaded = await loadMCPSnapshot();
      if (loaded && mcpSnapshot) {
        const elements = await mcpSnapshot.getInteractableBrowserElements(browser);
        this.mcpAvailable = elements.length >= 0;
        if (this.mcpAvailable) {
          logger.info('MCP snapshot available for browser context');
        }
      }
    } catch {
      this.mcpAvailable = false;
      logger.debug('MCP snapshot not available, falling back to WebDriverIO');
    }
  }

  isMCPAvailable(): boolean {
    return this.mcpAvailable;
  }

  async getMCPElements(): Promise<BrowserElementInfo[]> {
    if (!this.mcpAvailable || !mcpSnapshot) return [];
    try {
      return await mcpSnapshot.getInteractableBrowserElements(browser);
    } catch {
      return [];
    }
  }

  async url(url: string): Promise<unknown> {
    return browser.url(url);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async execute<T>(fn: (...args: any[]) => T | Promise<T>, ...args: any[]): Promise<T> {
    return browser.execute(fn, ...args) as Promise<T>;
  }

  async $(selector: string) {
    return browser.$(selector);
  }

  async keys(keys: string | string[]): Promise<void> {
    return browser.keys(keys);
  }

  async getUrl(): Promise<string> {
    return browser.getUrl();
  }

  async getTitle(): Promise<string> {
    return browser.getTitle();
  }

  async waitUntil(
    condition: () => Promise<boolean>,
    opts?: { timeout?: number; timeoutMsg?: string }
  ): Promise<unknown> {
    return browser.waitUntil(condition, opts);
  }

  async pause(ms: number): Promise<void> {
    return browser.pause(ms);
  }

  async closeSession(): Promise<void> {
    return browser.deleteSession();
  }

  async $$(selector: string) {
    return browser.$$(selector);
  }
}
