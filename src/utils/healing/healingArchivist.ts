import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import * as path from 'path';
import { logger } from '../logger';

export interface HealingEvent {
  timestamp: string;
  originalSelector: string;
  newSelector: string;
  reason: string;
  page: string;
  success: boolean;
  method: 'ollama' | 'fallback' | 'manual' | 'memory';
  duration: number;
  elementType?: string;
}

export interface LocatorRecord {
  currentSelector: string;
  originalSelector: string;
  page: string;
  healingCount: number;
  firstHealed: string;
  lastHealed: string;
  successRate: number;
  methods: string[];
}

export interface FlakyPattern {
  selectorPattern: string;
  failureFrequency: number;
  pagesAffected: string[];
  firstNoticed: string;
  lastFailure: string;
  recommendation?: string;
}

export interface HealingHistory {
  events: HealingEvent[];
  locators: Record<string, LocatorRecord>;
  flakyPatterns: Record<string, FlakyPattern>;
}

const HISTORY_FILE = path.resolve('healing-history.json');

export class HealingArchivist {
  private history: HealingHistory;

  constructor() {
    this.history = this.load();
  }

  recordHealing(event: HealingEvent): void {
    this.history.events.push(event);
    this.updateLocatorRecord(event);
    this.detectFlakiness(event);
    this.save();
    logger.info(`Archived healing event for ${event.originalSelector}`, {
      section: 'HEALING_ARCHIVIST',
      details: { page: event.page, method: event.method, success: event.success },
    });
  }

  getHealingHistory(page?: string, limit = 50): HealingEvent[] {
    let events = this.history.events;
    if (page) {
      events = events.filter((e) => e.page === page);
    }
    return events.slice(-limit);
  }

  findPastHealing(selector: string, page?: string): HealingEvent | undefined {
    return this.history.events
      .slice()
      .reverse()
      .find((e) => {
        const selectorMatch = e.originalSelector === selector || e.newSelector === selector;
        return page ? selectorMatch && e.page === page : selectorMatch;
      });
  }

  getLocatorReliability(page: string): LocatorRecord[] {
    return Object.values(this.history.locators).filter((l) => l.page === page);
  }

  getFlakyPatterns(minFrequency = 2): FlakyPattern[] {
    return Object.values(this.history.flakyPatterns).filter(
      (p) => p.failureFrequency >= minFrequency
    );
  }

  generateReport(): string {
    const lines: string[] = [];
    lines.push('Healing Archivist Report');
    lines.push('='.repeat(40));
    lines.push(`Total events: ${this.history.events.length}`);
    lines.push(`Unique locators tracked: ${Object.keys(this.history.locators).length}`);
    lines.push(`Flaky patterns detected: ${Object.keys(this.history.flakyPatterns).length}`);
    lines.push('');

    const flaky = this.getFlakyPatterns(2);
    if (flaky.length > 0) {
      lines.push('Flaky Patterns (frequency >= 2):');
      for (const p of flaky) {
        lines.push(`  - ${p.selectorPattern} (${p.failureFrequency}x, pages: ${p.pagesAffected.join(', ')})`);
      }
    }

    return lines.join('\n');
  }

  private updateLocatorRecord(event: HealingEvent): void {
    const key = `${event.page}:${event.originalSelector}`;
    if (!this.history.locators[key]) {
      this.history.locators[key] = {
        currentSelector: event.newSelector,
        originalSelector: event.originalSelector,
        page: event.page,
        healingCount: 0,
        firstHealed: event.timestamp,
        lastHealed: event.timestamp,
        successRate: 0,
        methods: [],
      };
    }

    const record = this.history.locators[key];
    record.healingCount++;
    record.lastHealed = event.timestamp;
    record.currentSelector = event.newSelector;
    if (!record.methods.includes(event.method)) {
      record.methods.push(event.method);
    }

    const totalEvents = this.history.events.filter(
      (e) => e.originalSelector === event.originalSelector && e.page === event.page
    ).length;
    const successfulEvents = this.history.events.filter(
      (e) => e.originalSelector === event.originalSelector && e.page === event.page && e.success
    ).length;
    record.successRate = totalEvents > 0 ? (successfulEvents / totalEvents) * 100 : 0;
  }

  private detectFlakiness(event: HealingEvent): void {
    const key = `${event.page}:${event.originalSelector}`;
    const record = this.history.locators[key];
    if (record && record.healingCount >= 2) {
      const pattern = this.extractSelectorPattern(event.originalSelector);
      if (!this.history.flakyPatterns[pattern]) {
        this.history.flakyPatterns[pattern] = {
          selectorPattern: pattern,
          failureFrequency: 0,
          pagesAffected: [],
          firstNoticed: event.timestamp,
          lastFailure: event.timestamp,
        };
      }
      const flaky = this.history.flakyPatterns[pattern];
      flaky.failureFrequency++;
      flaky.lastFailure = event.timestamp;
      if (!flaky.pagesAffected.includes(event.page)) {
        flaky.pagesAffected.push(event.page);
      }
    }
  }

  private extractSelectorPattern(selector: string): string {
    const withoutIds = selector.replace(/#[\w-]+/g, '#{id}');
    const withoutClasses = withoutIds.replace(/\.[\w-]+/g, '.{class}');
    const withoutText = withoutClasses.replace(/"[^"]*"/g, '"{text}"');
    const simplified = withoutText.replace(/:nth-child\(\d+\)/g, ':nth-child(N)');
    return simplified;
  }

  private load(): HealingHistory {
    if (existsSync(HISTORY_FILE)) {
      try {
        const content = readFileSync(HISTORY_FILE, 'utf-8');
        return JSON.parse(content);
      } catch {
        return this.emptyHistory();
      }
    }
    return this.emptyHistory();
  }

  private save(): void {
    try {
      const dir = path.dirname(HISTORY_FILE);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(HISTORY_FILE, JSON.stringify(this.history, null, 2));
    } catch (error) {
      logger.warn('Failed to save healing history', {
        section: 'HEALING_ARCHIVIST',
        details: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  private emptyHistory(): HealingHistory {
    return { events: [], locators: {}, flakyPatterns: {} };
  }
}

export const healingArchivist = new HealingArchivist();
