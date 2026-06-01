import {
  FlowMatrix,
  FlowMatrixConfig,
  DEFAULT_FLOW_CONFIG,
  ExtractedScenario,
} from './types'
import { explorePage } from './stateExplorer'
import { extractScenarios } from './scenarioExtractor'
import { OllamaClient } from '../ai/ollamaClient'

export interface DiscoveryResult {
  matrix: FlowMatrix
  scenarios: ExtractedScenario[]
  log: string[]
}

export async function discoverAndGenerate(
  url: string,
  ollamaClient: OllamaClient,
  config: FlowMatrixConfig = DEFAULT_FLOW_CONFIG
): Promise<DiscoveryResult> {
  const result = await Promise.race([
    explorePage(url, ollamaClient, config).then(({ matrix, log }) => ({ matrix, log })),
    new Promise<{ matrix: FlowMatrix; log: string[] }>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Discovery timed out after ${config.totalTimeoutMs}ms`)),
        config.totalTimeoutMs + 30000
      )
    ),
  ])

  const { matrix, log } = result

  const scenarios = extractScenarios(matrix, config)

  return { matrix, scenarios, log }
}

export { FlowMatrixConfig, DEFAULT_FLOW_CONFIG, ExtractedScenario }
