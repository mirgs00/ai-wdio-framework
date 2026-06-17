declare module 'papaparse' {
  interface ParseConfig {
    header?: boolean;
    skipEmptyLines?: boolean;
  }

  interface ParseResult<T> {
    data: T[];
    errors: Array<{ message: string }>;
  }

  function parse<T = Record<string, string>>(content: string, config?: ParseConfig): ParseResult<T>;

  export { parse, ParseConfig, ParseResult };
}
