const mammoth = {
  convertToHtml: jest.fn().mockResolvedValue({ value: '', messages: [] }),
  extractRawText: jest.fn().mockResolvedValue({ value: '' }),
};

export default mammoth;
