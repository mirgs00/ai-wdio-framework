import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const CACHE_DIR = path.join(process.cwd(), '.cache');
const CACHE_VALIDITY_MS = 3600000; // 1 hour

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

      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as CacheEntry<string>;

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

      const hash = this.generateHash(url);
      const cachePath = path.join(CACHE_DIR, `${hash}.json`);

      const cacheEntry: CacheEntry<string> = {
        timestamp: Date.now(),
        data: dom,
        hash: this.generateHash(dom),
      };

      fs.writeFileSync(cachePath, JSON.stringify(cacheEntry), 'utf-8');
    } catch (error) {
      // Silently fail if caching fails
      console.warn('Failed to cache DOM:', error instanceof Error ? error.message : error);
    }
  }

  static clearCache(): void {
    try {
      if (fs.existsSync(CACHE_DIR)) {
        fs.rmSync(CACHE_DIR, { recursive: true });
      }
    } catch (error) {
      console.warn('Failed to clear cache:', error instanceof Error ? error.message : error);
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
      console.warn(
        'Failed to clear expired cache:',
        error instanceof Error ? error.message : error
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
  private static readonly MAX_MEMORY_ENTRIES = 50;

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
    // Implement simple LRU eviction if cache is too large
    if (ResultCache.cache.size >= ResultCache.MAX_MEMORY_ENTRIES) {
      const firstKey = ResultCache.cache.keys().next().value;
      ResultCache.cache.delete(firstKey);
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
