export const browser = {
  url: jest.fn(),
  execute: jest.fn(),
  $: jest.fn(),
  $$: jest.fn(),
  keys: jest.fn(),
  getUrl: jest.fn().mockResolvedValue('https://example.com'),
  getTitle: jest.fn().mockResolvedValue('Test Page'),
  waitUntil: jest.fn(),
  pause: jest.fn(),
  deleteSession: jest.fn(),
  addCommand: jest.fn(),
};
