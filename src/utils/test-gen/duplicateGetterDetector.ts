import { readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import { logger } from '../logger';

export interface DuplicateGetterInfo {
  getterName: string;
  count: number;
  locations: Array<{ line: number; selector: string }>;
}

export interface DuplicateDetectionReport {
  pageName: string;
  filePath: string;
  hasDuplicates: boolean;
  duplicates: DuplicateGetterInfo[];
  totalGetters: number;
  uniqueGetters: number;
}

export class DuplicateGetterDetector {
  /**
   * Analyzes a page object file for duplicate getters
   */
  static analyzePageObject(filePath: string): DuplicateDetectionReport {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    const getters = this.extractGetters(content, lines);
    const duplicates = this.findDuplicates(getters);

    const fileName = path.basename(filePath);
    const pageName = fileName.replace(/^generated/, '').replace(/Page\.ts$/, '');

    return {
      pageName,
      filePath,
      hasDuplicates: duplicates.length > 0,
      duplicates,
      totalGetters: getters.length,
      uniqueGetters: new Set(getters.map(g => g.name)).size
    };
  }

  /**
   * Analyzes all page objects in a directory
   */
  static analyzePageObjects(pageObjectsDir: string): DuplicateDetectionReport[] {
    const fs = require('fs');
    const files = fs.readdirSync(pageObjectsDir)
      .filter((f: string) => f.startsWith('generated') && f.endsWith('Page.ts'));

    const reports: DuplicateDetectionReport[] = [];
    
    for (const file of files) {
      const filePath = path.join(pageObjectsDir, file);
      try {
        const report = this.analyzePageObject(filePath);
        reports.push(report);
      } catch (error) {
        logger.warn(`Failed to analyze page object: ${file}`, {
          section: 'DUPLICATE_DETECTOR',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return reports;
  }

  /**
   * Generates a formatted report of duplicate getters
   */
  static generateReport(reports: DuplicateDetectionReport[]): string {
    const lines: string[] = [
      '\n📋 Duplicate Getter Detection Report',
      '═════════════════════════════════════\n'
    ];

    const reportsWithDuplicates = reports.filter(r => r.hasDuplicates);

    if (reportsWithDuplicates.length === 0) {
      lines.push('✅ No duplicate getters found!\n');
      return lines.join('\n');
    }

    lines.push(`⚠️  Found ${reportsWithDuplicates.length} page(s) with duplicate getters\n`);

    for (const report of reportsWithDuplicates) {
      lines.push(`📄 ${report.pageName}Page.ts`);
      lines.push(`   Total getters: ${report.totalGetters}, Unique: ${report.uniqueGetters}`);
      lines.push('   Duplicates:');

      for (const dup of report.duplicates) {
        lines.push(`     • ${dup.getterName} (appears ${dup.count} times)`);
        for (const loc of dup.locations) {
          lines.push(`       - Line ${loc.line}: ${loc.selector}`);
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Fixes duplicate getters by merging them into a single multi-selector getter
   */
  static fixDuplicates(filePath: string, autoMerge: boolean = false): { success: boolean; message: string } {
    try {
      const report = this.analyzePageObject(filePath);
      
      if (!report.hasDuplicates) {
        return { success: true, message: `No duplicates found in ${report.pageName}` };
      }

      if (!autoMerge) {
        return { success: false, message: `Duplicates found in ${report.pageName}. Use autoMerge=true to fix automatically.` };
      }

      let content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (const duplicate of report.duplicates) {
        const getterName = duplicate.getterName;
        const selectors = duplicate.locations.map(loc => loc.selector).filter((s, i, arr) => arr.indexOf(s) === i);

        const mergedSelector = selectors.join(', ');

        const getterRegex = new RegExp(
          `get\\s+${getterName}\\s*\\(\\s*\\)\\s*{[^}]+}`,
          'g'
        );

        const replacement = `get ${getterName}() {\n    return $('${mergedSelector}');\n  }`;

        content = content.replace(getterRegex, replacement);
      }

      writeFileSync(filePath, content);

      logger.info(`Fixed duplicate getters in ${report.pageName}`, {
        section: 'DUPLICATE_DETECTOR',
        duplicatesFixed: report.duplicates.length
      });

      return { success: true, message: `Fixed ${report.duplicates.length} duplicate getter(s) in ${report.pageName}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Error fixing duplicates: ${message}` };
    }
  }

  private static extractGetters(
    content: string,
    lines: string[]
  ): Array<{ name: string; selector: string; line: number }> {
    const getters: Array<{ name: string; selector: string; line: number }> = [];

    const getterRegex = /get\s+(\w+)\s*\(\s*\)\s*{\s*return\s+\$\(['"`]([^'"`]+)['"`]\)/g;
    
    let match;
    while ((match = getterRegex.exec(content)) !== null) {
      const getterName = match[1];
      const selector = match[2];
      const line = content.substring(0, match.index).split('\n').length;

      getters.push({ name: getterName, selector, line });
    }

    return getters;
  }

  private static findDuplicates(getters: Array<{ name: string; selector: string; line: number }>): DuplicateGetterInfo[] {
    const getterMap = new Map<string, Array<{ line: number; selector: string }>>();

    for (const getter of getters) {
      if (!getterMap.has(getter.name)) {
        getterMap.set(getter.name, []);
      }
      getterMap.get(getter.name)!.push({ line: getter.line, selector: getter.selector });
    }

    const duplicates: DuplicateGetterInfo[] = [];

    for (const [getterName, locations] of getterMap.entries()) {
      if (locations.length > 1) {
        duplicates.push({
          getterName,
          count: locations.length,
          locations
        });
      }
    }

    return duplicates.sort((a, b) => b.count - a.count);
  }
}
