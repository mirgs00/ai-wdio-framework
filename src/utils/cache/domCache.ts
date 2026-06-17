import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { CACHE_CONFIG } from '../constants';
import { logger } from '../logger';

const CACHE_DIR = path.join(process.cwd(), CACHE_CONFIG.DIR);
const CACHE_VALIDITY_MS = CACHE_CONFIG.VALIDITY_MS;

export interface CacheEntry<T = unknown> {
  timestamp: number;
  data: T;
  hash: string;
}

export class DOMCache {
  static async getCachedDOM(url: string): Promise<string | null> {
    const hash = this.generateHash(url);
    const cachePath = path.join(CACHE_DIR, `${hash}.json`);

    try {
      if (!fs.existsSync(cachePath)) {
        return null;
      }

      const raw = fs.readFileSync(cachePath, 'utf-8');
      let cached: CacheEntry<string>;
      try {
        cached = JSON.parse(raw) as CacheEntry<string>;
      } catch {
        // Corrupt cache file — delete and return null
        fs.unlinkSync(cachePath);
        return null;
      }

      // Check if cache is still valid
      if (Date.now() - cached.timestamp < CACHE_VALIDITY_MS) {
        return cached.data;
      }

      // Cache expired, delete it
      fs.unlinkSync(cachePath);
      return null;
    } catch (error) {
      return null;
    }
  }

  static async cacheDOM(url: string, dom: string): Promise<void> {
    try {
      this.ensureCacheDir();

      // Enforce filesystem entry limit
      this.enforceMaxEntries();

      const hash = this.generateHash(url);
      const cachePath = path.join(CACHE_DIR, `${hash}.json`);
      const tmpPath = cachePath + '.tmp';

      const cacheEntry: CacheEntry<string> = {
        timestamp: Date.now(),
        data: dom,
        hash: this.generateHash(dom),
      };

      // Atomic write: write to temp file, then rename
      fs.writeFileSync(tmpPath, JSON.stringify(cacheEntry), 'utf-8');
      fs.renameSync(tmpPath, cachePath);
    } catch (error) {
      logger.warn(`Failed to cache DOM: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static clearCache(): void {
    try {
      if (fs.existsSync(CACHE_DIR)) {
        fs.rmSync(CACHE_DIR, { recursive: true });
      }
    } catch (error) {
      logger.warn(`Failed to clear cache: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static clearExpiredCache(): void {
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        return;
      }

      const files = fs.readdirSync(CACHE_DIR);
      for (const file of files) {
        const filePath = path.join(CACHE_DIR, file);
        try {
          const content = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as CacheEntry;
          if (Date.now() - content.timestamp > CACHE_VALIDITY_MS) {
            fs.unlinkSync(filePath);
          }
        } catch {
          // Skip invalid cache files
        }
      }
    } catch (error) {
      logger.warn(
        `Failed to clear expired cache: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private static generateHash(data: string): string {
    return crypto.createHash('md5').update(data).digest('hex');
  }

  private static ensureCacheDir(): void {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  }

  private static enforceMaxEntries(): void {
    try {
      if (!fs.existsSync(CACHE_DIR)) return;
      const files = fs.readdirSync(CACHE_DIR);
      if (files.length >= CACHE_CONFIG.MAX_FILESYSTEM_ENTRIES) {
        // Sort by mtime oldest first and delete oldest
        const sorted = files
          .map((f) => ({ name: f, time: fs.statSync(path.join(CACHE_DIR, f)).mtimeMs }))
          .sort((a, b) => a.time - b.time);
        const toDelete = sorted.slice(0, sorted.length - CACHE_CONFIG.MAX_FILESYSTEM_ENTRIES + 1);
        for (const file of toDelete) {
          fs.unlinkSync(path.join(CACHE_DIR, file.name));
        }
      }
    } catch (error) {
      logger.warn(`Failed to enforce cache max entries: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static getCacheStats(): {
    totalFiles: number;
    totalSize: number;
    expiredFiles: number;
  } {
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        return { totalFiles: 0, totalSize: 0, expiredFiles: 0 };
      }

      const files = fs.readdirSync(CACHE_DIR);
      let totalSize = 0;
      let expiredFiles = 0;

      for (const file of files) {
        const filePath = path.join(CACHE_DIR, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;

        try {
          const content = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as CacheEntry;
          if (Date.now() - content.timestamp > CACHE_VALIDITY_MS) {
            expiredFiles++;
          }
        } catch {
          // Skip invalid cache files
        }
      }

      return { totalFiles: files.length, totalSize, expiredFiles };
    } catch (error) {
      return { totalFiles: 0, totalSize: 0, expiredFiles: 0 };
    }
  }
}

export class ResultCache {
  private static cache: Map<string, CacheEntry> = new Map();
  private static readonly MAX_MEMORY_ENTRIES = CACHE_CONFIG.MAX_MEMORY_ENTRIES;

  static get<T>(key: string): T | null {
    const entry = ResultCache.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry is still valid
    if (Date.now() - entry.timestamp < CACHE_VALIDITY_MS) {
      return entry.data as T;
    }

    ResultCache.cache.delete(key);
    return null;
  }

  static set<T>(key: string, value: T): void {
    if (ResultCache.cache.size >= ResultCache.MAX_MEMORY_ENTRIES) {
      const firstKey = ResultCache.cache.keys().next().value;
      if (firstKey !== undefined) {
        ResultCache.cache.delete(firstKey);
      }
    }

    ResultCache.cache.set(key, {
      timestamp: Date.now(),
      data: value,
      hash: '',
    });
  }

  static clear(): void {
    ResultCache.cache.clear();
  }

  static getSize(): number {
    return ResultCache.cache.size;
  }
}
