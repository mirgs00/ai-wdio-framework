import Papa from 'papaparse';
import type { Instructions, InstructionTestCase } from '../test-gen/instructionParser';

const STEPS_DELIMITER = '|';

export function parseCsv(content: string, filePath?: string): Instructions {
  const lines = content.split('\n');
  const metadata: Partial<Instructions> = {};
  const dataLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 2) {
        const key = trimmed.slice(2, colonIdx).trim();
        const value = trimmed.slice(colonIdx + 1).trim();
        if (key === 'projectName') metadata.projectName = value;
        else if (key === 'url') metadata.url = value;
        else if (key === 'description') metadata.description = value;
      }
    } else if (trimmed.length > 0 && !trimmed.startsWith('#')) {
      dataLines.push(trimmed);
    }
  }

  const csvContent = dataLines.join('\n');
  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    throw new Error(
      `CSV parse error${filePath ? ` in ${filePath}` : ''}: ${parsed.errors[0].message}`
    );
  }

  const rows = parsed.data as Array<Record<string, string>>;
  const testCases: InstructionTestCase[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = (row.name || '').trim();
    const description = (row.description || '').trim();
    const stepsRaw = (row.steps || '').trim();
    const tagsRaw = (row.tags || '').trim();

    if (!name || !description || !stepsRaw) {
      throw new Error(
        `Row ${i + 2}: missing required column(s). Expected: name, description, steps`
      );
    }

    testCases.push({
      name,
      description,
      steps: stepsRaw.split(STEPS_DELIMITER).map((s) => s.trim()).filter(Boolean),
      tags: tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [],
    });
  }

  return {
    projectName: metadata.projectName || 'Generated Tests',
    url: metadata.url || '',
    description: metadata.description || '',
    testCases,
  };
}
