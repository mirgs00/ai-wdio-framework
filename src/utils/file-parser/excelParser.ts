import ExcelJS from 'exceljs';
import type { Instructions, InstructionTestCase } from '../test-gen/instructionParser';

const STEPS_DELIMITER = '|';

export async function parseExcel(filePath: string): Promise<Instructions> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const metadata: Partial<Instructions> = {};
  const projectSheet = workbook.getWorksheet('Project');
  if (projectSheet) {
    projectSheet.eachRow((row) => {
      const key = String(row.getCell(1).value || '').trim();
      const value = String(row.getCell(2).value || '').trim();
      if (key === 'projectName') metadata.projectName = value;
      else if (key === 'url') metadata.url = value;
      else if (key === 'description') metadata.description = value;
    });
  }

  const testCases: InstructionTestCase[] = [];
  const casesSheet = workbook.getWorksheet('Test Cases');
  if (!casesSheet) {
    throw new Error(`Excel file ${filePath} is missing a "Test Cases" sheet`);
  }

  let headerRow = true;
  casesSheet.eachRow((row) => {
    if (headerRow) {
      headerRow = false;
      return;
    }
    const name = String(row.getCell(1).value || '').trim();
    const description = String(row.getCell(2).value || '').trim();
    const stepsRaw = String(row.getCell(3).value || '').trim();
    const tagsRaw = String(row.getCell(4).value || '').trim();

    if (!name || !description || !stepsRaw) return;

    testCases.push({
      name,
      description,
      steps: stepsRaw.split(STEPS_DELIMITER).map((s) => s.trim()).filter(Boolean),
      tags: tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [],
    });
  });

  return {
    projectName: metadata.projectName || 'Generated Tests',
    url: metadata.url || '',
    description: metadata.description || '',
    testCases,
  };
}
