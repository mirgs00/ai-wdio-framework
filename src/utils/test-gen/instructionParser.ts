// Legacy type stubs — retained for backward compatibility with file-parser imports

export interface PageInfo {
  name: string
  url: string
  description?: string
  elements?: string[]
}

export interface InstructionTestCase {
  name: string
  description: string
  steps: string[]
  tags: string[]
  pages?: PageInfo[]
}

export interface Instructions {
  projectName: string
  url: string
  description: string
  testCases: InstructionTestCase[]
  pages?: PageInfo[]
}

export class InstructionParser {
  async parse(_input: string): Promise<Instructions> {
    return {
      projectName: 'Generated',
      url: '',
      description: '',
      testCases: [],
    }
  }
}
