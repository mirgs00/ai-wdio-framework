import { readFileSync } from 'fs';
import type { Instructions } from '../test-gen/instructionParser';
import { parseCsv } from './csvParser';
import { parseExcel } from './excelParser';
import { parseDocx } from './docxParser';

function detectFormat(filePath: string): 'json' | 'csv' | 'xlsx' | 'docx' {
  const ext = filePath.toLowerCase().split('.').pop() || '';
  if (ext === 'json') return 'json';
  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx') return 'xlsx';
  if (ext === 'docx') return 'docx';
  throw new Error(`Unsupported file format: .${ext}. Supported: .json, .csv, .xlsx, .docx`);
}

export async function parseInstructionFile(filePath: string): Promise<Instructions> {
  const format = detectFormat(filePath);

  switch (format) {
    case 'json': {
      const content = readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as Instructions;
    }
    case 'csv': {
      const content = readFileSync(filePath, 'utf-8');
      return parseCsv(content, filePath);
    }
    case 'xlsx':
      return parseExcel(filePath);
    case 'docx':
      return parseDocx(filePath);
  }
}
