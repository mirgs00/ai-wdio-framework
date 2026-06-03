const Papa = {
  parse: jest.fn().mockReturnValue({ data: [], errors: [] }),
  unparse: jest.fn().mockReturnValue(''),
};

export default Papa;
