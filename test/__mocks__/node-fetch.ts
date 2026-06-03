interface RequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
  timeout?: number;
}

const fetch = jest.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: jest.fn().mockResolvedValue({}),
  text: jest.fn().mockResolvedValue(''),
});

export default fetch;
export class AbortError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'AbortError';
  }
}
export type { RequestInit };
