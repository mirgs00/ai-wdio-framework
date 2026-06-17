import {
  FlowMatrix,
  FlowMatrixConfig,
  DEFAULT_FLOW_CONFIG,
  ExtractedScenario,
} from './types'
import { explorePage } from './stateExplorer'
import { extractScenarios } from './scenarioExtractor'
import { discoverInteractions } from './interactionDiscovery'
import { generateCombinatorialScenarios } from './combinatorialGenerator'
import type { LLMProvider } from '../ai/types'
import type { BrowserContext } from './interactionEngine'
import { logger } from '../logger'

export interface DiscoveryResult {
  matrix: FlowMatrix
  scenarios: ExtractedScenario[]
  log: string[]
}

/**
 * Discover and generate test scenarios using the combinatorial interaction approach.
 * Falls back to BFS exploration if combinatorial discovery fails.
 */
export async function discoverAndGenerate(
  url: string,
  llmProvider: LLMProvider,
  config: FlowMatrixConfig = DEFAULT_FLOW_CONFIG,
  browserCtx?: BrowserContext
): Promise<DiscoveryResult> {
  // Try combinatorial approach first
  if (browserCtx) {
    try {
      logger.info('Using combinatorial interaction discovery...')
      const tree = await discoverInteractions(browserCtx, url, {
        maxDepth: config.maxDepth,
        maxInteractions: config.maxInteractionsPerState * 3,
        timeoutMs: config.totalTimeoutMs,
      })

      const scenarios = generateCombinatorialScenarios(tree)
      logger.info(`Combinatorial discovery: ${scenarios.length} scenarios from ${tree.radioGroups.length} radio groups`)

      // Build a minimal FlowMatrix for compatibility
      const matrix: FlowMatrix = {
        rootUrl: url,
        states: new Map(),
        transitions: [],
        startStateId: 'start',
      }

      return { matrix, scenarios, log: [`Combinatorial discovery: ${tree.interactions.length} interactions, ${tree.radioGroups.length} radio groups`] }
    } catch (error) {
      logger.warn(`Combinatorial discovery failed: ${error instanceof Error ? error.message : String(error)}`)
      logger.info('Falling back to BFS exploration...')
    }
  }

  // Fallback: BFS exploration
  const result = await Promise.race([
    explorePage(url, llmProvider, config).then(({ matrix, log }) => ({ matrix, log })),
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
