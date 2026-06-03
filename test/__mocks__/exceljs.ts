const ExcelJS = {
  Workbook: class {
    xlsx = { readFile: jest.fn(), writeFile: jest.fn() };
    getWorksheet = jest.fn();
    addWorksheet = jest.fn();
  },
};

export default ExcelJS;
