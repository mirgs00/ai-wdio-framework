import type { Instructions } from '../test-gen/instructionParser';

export { Instructions };
export type ParseResult = Instructions;
export interface FileParseError {
  filePath: string;
  format: string;
  message: string;
}
