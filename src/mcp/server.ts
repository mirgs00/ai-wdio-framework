import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ServiceContainer } from '../services/ServiceContainer';
import { GenerationPipeline } from '../services/GenerationPipeline';
import { createDefaultLLMProvider } from '../utils/ai/factory';
import { TestRunnerService } from '../services/TestRunnerService';
import { logger } from '../utils/logger';

const server = new Server(
  { name: 'ai-wdio', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

const container = new ServiceContainer({
  llmProvider: createDefaultLLMProvider(),
});
const pipeline = new GenerationPipeline(container);
const testRunner = new TestRunnerService();

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'generate-tests',
      description: 'Generate Cucumber test artifacts (feature files, page objects, step definitions) from a website URL using AI-powered flow-matrix discovery.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The website URL to generate tests for' },
          instruction: { type: 'string', description: 'Optional description of what to test' },
          maxDepth: { type: 'number', description: 'Max navigation depth (default: 3)' },
          maxStates: { type: 'number', description: 'Max states to discover (default: 20)' },
        },
        required: ['url'],
      },
    },
    {
      name: 'explore-page',
      description: 'Explore a website URL and return discovered states, transitions, and scenarios without generating test files.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The website URL to explore' },
          maxDepth: { type: 'number', description: 'Max navigation depth (default: 3)' },
          maxStates: { type: 'number', description: 'Max states to discover (default: 20)' },
        },
        required: ['url'],
      },
    },
    {
      name: 'run-tests',
      description: 'Run generated Cucumber tests via WebDriverIO.',
      inputSchema: {
        type: 'object',
        properties: {
          featureFile: { type: 'string', description: 'Path to the feature file to run' },
          timeout: { type: 'number', description: 'Test timeout in ms (default: 60000)' },
        },
        required: ['featureFile'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'generate-tests': {
        const url = args?.url as string;
        const instruction = args?.instruction as string | undefined;
        const maxDepth = (args?.maxDepth as number) || 3;
        const maxStates = (args?.maxStates as number) || 20;

        const result = await pipeline.generate({
          url,
          instruction,
          mode: 'flow-matrix',
          config: { maxDepth, maxStates },
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              featureFile: result.featureFilePath,
              pageObjects: result.pageObjectPaths,
              stepDefinitions: result.stepDefinitionsPath,
              scenarioCount: result.scenarioCount,
            }, null, 2),
          }],
        };
      }

      case 'explore-page': {
        const { discoverAndGenerate } = await import('../utils/flow-matrix/flowMatrixBuilder');
        const url = args?.url as string;
        const maxDepth = (args?.maxDepth as number) || 3;
        const maxStates = (args?.maxStates as number) || 20;

        const { matrix, scenarios, log } = await discoverAndGenerate(url, container.llmProvider, {
          maxDepth,
          maxStates,
          maxInteractionsPerState: 10,
          timeoutPerState: 15000,
          totalTimeoutMs: 120000,
          maxRadioDepth: 3,
        });

        const states = Array.from(matrix.states.values()).map((s) => ({
          id: s.id,
          url: s.url,
          pageType: s.pageType,
          elementCount: s.elements.length,
        }));

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              stateCount: matrix.states.size,
              transitionCount: matrix.transitions.length,
              scenarioCount: scenarios.length,
              states,
              scenarios: scenarios.map((s) => ({ name: s.name, tags: s.tags, stepCount: s.steps.length })),
              log,
            }, null, 2),
          }],
        };
      }

      case 'run-tests': {
        const featureFile = args?.featureFile as string;
        const timeout = (args?.timeout as number) || 60000;

        await testRunner.runTests(featureFile, timeout);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, message: 'Tests executed successfully' }),
          }],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('AI-WDIO MCP server running on stdio');
}

main().catch((error) => {
  logger.error('MCP server failed to start', error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});
