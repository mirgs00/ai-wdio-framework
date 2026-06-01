import ExcelJS from 'exceljs';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, BorderStyle, AlignmentType } from 'docx';
import { writeFileSync } from 'fs';

/* ── Excel Template ── */
async function generateExcel() {
  const workbook = new ExcelJS.Workbook();

  const projectSheet = workbook.addWorksheet('Project');
  projectSheet.columns = [
    { header: 'Key', key: 'key', width: 20 },
    { header: 'Value', key: 'value', width: 60 },
  ];
  projectSheet.addRows([
    { key: 'projectName', value: 'Login Page Tests' },
    { key: 'url', value: 'https://practicetestautomation.com/practice-test-login/' },
    { key: 'description', value: 'Test the login page with positive and negative credential flows' },
  ]);

  const casesSheet = workbook.addWorksheet('Test Cases');
  casesSheet.columns = [
    { header: 'name', key: 'name', width: 25 },
    { header: 'description', key: 'description', width: 40 },
    { header: 'steps', key: 'steps', width: 70 },
    { header: 'tags', key: 'tags', width: 25 },
  ];
  casesSheet.addRows([
    {
      name: 'Successful Login',
      description: 'User should be able to login with valid credentials',
      steps: "User navigates to login page|User enters username 'student'|User enters password 'Password123'|User clicks login button|User sees confirmation",
      tags: 'happy-path,positive',
    },
    {
      name: 'Failed Login',
      description: 'System should reject incorrect credentials',
      steps: "User navigates to login page|User enters username 'wrong'|User enters password 'wrong'|User clicks login button|User sees error",
      tags: 'negative',
    },
  ]);

  await workbook.xlsx.writeFile('instructions-template.xlsx');
  console.log('✅ instructions-template.xlsx');
}

/* ── Word Template ── */
async function generateDocx() {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: 'Test Instructions Template',
          heading: 'Heading1',
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        }),
        new Paragraph({
          text: 'Table 1: Project Information',
          heading: 'Heading2',
          spacing: { before: 200, after: 200 },
        }),
        new Table({
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'projectName', bold: true })] })] }),
                new TableCell({ children: [new Paragraph('Login Page Tests')] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'url', bold: true })] })] }),
                new TableCell({ children: [new Paragraph('https://practicetestautomation.com/practice-test-login/')] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'description', bold: true })] })] }),
                new TableCell({ children: [new Paragraph('Test the login page with positive and negative credential flows')] }),
              ],
            }),
          ],
        }),
        new Paragraph({
          text: 'Table 2: Test Cases',
          heading: 'Heading2',
          spacing: { before: 400, after: 200 },
        }),
        new Table({
          rows: [
            new TableRow({
              tableHeader: true,
              children: ['name', 'description', 'steps', 'tags'].map((h) =>
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
                })
              ),
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('Successful Login')] }),
                new TableCell({ children: [new Paragraph('User should be able to login with valid credentials')] }),
                new TableCell({ children: [new Paragraph("User navigates to login page|User enters username 'student'|User enters password 'Password123'|User clicks login button|User sees confirmation")] }),
                new TableCell({ children: [new Paragraph('happy-path,positive')] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('Failed Login')] }),
                new TableCell({ children: [new Paragraph('System should reject incorrect credentials')] }),
                new TableCell({ children: [new Paragraph("User navigates to login page|User enters username 'wrong'|User enters password 'wrong'|User clicks login button|User sees error")] }),
                new TableCell({ children: [new Paragraph('negative')] }),
              ],
            }),
          ],
        }),
        new Paragraph({
          text: 'Note: Steps are pipe-delimited (|). Tags are comma-delimited. The first row of each table is treated as header.',
          spacing: { before: 400 },
          style: 'IntenseQuote',
        }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  writeFileSync('instructions-template.docx', buffer);
  console.log('✅ instructions-template.docx');
}

await generateExcel();
await generateDocx();
