// Legacy stub — retained for backward compatibility with TestGenerationService import

import { writeFileSync, existsSync } from 'fs'
import { mkdirSync } from 'fs'
import * as path from 'path'

const FEATURES_PATH = path.resolve('src/features')

export async function buildScenario(_url: string, _instruction: string): Promise<string> {
  if (!existsSync(FEATURES_PATH)) {
    mkdirSync(FEATURES_PATH, { recursive: true })
  }
  const filePath = path.join(FEATURES_PATH, 'generated.feature')
  writeFileSync(filePath, 'Feature: Generated\n', 'utf-8')
  return filePath
}
