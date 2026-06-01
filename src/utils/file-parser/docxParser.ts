import mammoth from 'mammoth';
import type { Instructions, InstructionTestCase } from '../test-gen/instructionParser';

const STEPS_DELIMITER = '|';

interface TableCell {
  text: string;
}

interface TableRow {
  cells: TableCell[];
}

interface Table {
  rows: TableRow[];
}

async function extractTables(filePath: string): Promise<Table[]> {
  const buffer = require('fs').readFileSync(filePath);
  const result = await mammoth.convertToHtml({ buffer });
  const html = result.value;

  const tables: Table[] = [];
  const tableRegex = /<table>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHtml = tableMatch[1];
    const rows: TableRow[] = [];
    const rowRegex = /<tr>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      const rowHtml = rowMatch[1];
      const cells: TableCell[] = [];
      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cellMatch: RegExpExecArray | null;

      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        cells.push({ text: cellMatch[1].replace(/<[^>]+>/g, '').trim() });
      }

      if (cells.length > 0) {
        rows.push({ cells });
      }
    }

    if (rows.length > 0) {
      tables.push({ rows });
    }
  }

  return tables;
}

export async function parseDocx(filePath: string): Promise<Instructions> {
  const tables = await extractTables(filePath);

  if (tables.length === 0) {
    throw new Error(`No tables found in Word document: ${filePath}`);
  }

  const metadata: Partial<Instructions> = {};
  const projectTable = tables[0];

  for (const row of projectTable.rows) {
    if (row.cells.length >= 2) {
      const key = row.cells[0].text;
      const value = row.cells[1].text;
      if (key === 'projectName') metadata.projectName = value;
      else if (key === 'url') metadata.url = value;
      else if (key === 'description') metadata.description = value;
    }
  }

  const testCases: InstructionTestCase[] = [];

  if (tables.length >= 2) {
    const casesTable = tables[1];
    let headerRow = true;

    for (const row of casesTable.rows) {
      if (headerRow) {
        headerRow = false;
        continue;
      }

      if (row.cells.length < 3) continue;

      const name = row.cells[0].text;
      const description = row.cells[1].text;
      const stepsRaw = row.cells[2].text;
      const tagsRaw = row.cells.length >= 4 ? row.cells[3].text : '';

      if (!name || !description || !stepsRaw) continue;

      testCases.push({
        name,
        description,
        steps: stepsRaw.split(STEPS_DELIMITER).map((s) => s.trim()).filter(Boolean),
        tags: tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [],
      });
    }
  }

  return {
    projectName: metadata.projectName || 'Generated Tests',
    url: metadata.url || '',
    description: metadata.description || '',
    testCases,
  };
}
