---
description: Test generation agent for the AI-Powered WebDriverIO framework. Runs the flow-matrix CLI to auto-discover pages, generate Cucumber feature files, page objects, and step definitions. Use when generating new tests from a URL or debugging the test generation pipeline.
mode: subagent
---

# Test Generator Agent

You operate the **flow-matrix test generation pipeline** for the
AI-Powered WebDriverIO Test Automation Framework.

## Quick Start

```bash
npx ts-node src/cli.ts <url> [options]
```

## CLI Reference

| Flag | Default | Purpose |
|------|---------|---------|
| `--model <model>` | `llama3` | Ollama model for AI form-data generation |
| `--max-depth <n>` | `3` | Max navigation depth (how many clicks deep) |
| `--max-states <n>` | `20` | Max states to discover before stopping |
| `--max-radio-depth <n>` | `3` | How deep to chain cascading radio selections |
| `--ai-timeout <ms>` | `15000` | Timeout for individual AI calls |
| `--no-run` | — | Generate artifacts without executing tests |
| `--healing` | — | Run self-healing workflow to fix broken selectors |
| `--rerun` | — | Re-run failed tests from last execution |
| `--rerun-steps` | — | Rerun failed steps with artifact regeneration |
| `--check-duplicates` | — | Check for duplicate getters in page objects |
| `--fix` | — | Auto-merge duplicate getters |
| `--validate` | — | Dry-run: check if all selectors exist in DOM |

## npm Scripts

| Command | Purpose |
|---------|---------|
| `npm run generateAndRun` | Generate + run tests (OpenAI) |
| `npm run generateAndRunWithOllama` | Generate + run tests (local Ollama) |
| `npm run wdio` | Run existing tests |
| `npm run lint` | ESLint check |
| `npm run format` | Prettier format |

## Pipeline Steps

### 1. Discovery

```bash
npx ts-node src/cli.ts https://example.com --no-run
```

The engine launches a headless browser, navigates the page, and builds a
**flow matrix** — a graph of states (URL + element fingerprint) and transitions
(clicks, form fills, submits).

### 2. Generated Artifacts

After discovery, the pipeline produces three files:

| File | Path | Contents |
|------|------|----------|
| Feature file | `src/features/generated_<host>.feature` | Cucumber Gherkin scenarios |
| Page objects | `src/page-objects/generatedPage.ts` | Element getters + helper methods |
| Step definitions | `src/step-definitions/generatedSteps.ts` | Cucumber step implementations |

### 3. Run Tests

```bash
npm run wdio
```

Or with the single-command flow:

```bash
npm run generateAndRunWithOllama
```

## Radio Cascade Scenarios

When the framework detects radio buttons on a page, it generates:

- **`@radio-variant`** scenarios — single radio selection
- **`@radio-matrix`** scenarios — chained multi-level cascades

Control depth with `--max-radio-depth <n>`. Higher values produce more
combinatorial scenarios but take longer.

## Debugging Failed Generations

### Symptom: No scenarios generated

- Check that the URL is accessible
- Try `--max-depth 2` — the page may be deeper than expected
- Verify the browser works: the CLI logs each state discovered

### Symptom: Radio scenarios only at first level

- The flow-matrix engine captures cascading radio states automatically
- The `--max-radio-depth` flag controls how deep the scenario generator chains them
- Default is 3; increase if you have deeper cascades
- Re-run with `--max-radio-depth 4 --no-run` to regenerate without executing

### Symptom: Tests fail with "element not found"

- Run `npx ts-node src/cli.ts --healing` to trigger self-healing
- The healing workflow re-discovers element locators using the LLM
- Page objects and step definitions are auto-updated

### Symptom: Duplicate getters in page objects

```bash
npx ts-node src/cli.ts --check-duplicates --fix
```

This merges duplicate getters that point to the same selector.

## Verifying Generated Artifacts

After generation, inspect the output:

- Feature file: `src/features/generated_*.feature`
- Step defs: `src/step-definitions/generatedSteps.ts`
- Page objects: `src/page-objects/generatedPage.ts`
- Discovery log: printed to stdout during generation

Look for:
- Correct URL in `Given the user navigates to "..."` steps
- Radio/select option coverage
- Submit steps where appropriate
- Title/URL verification steps
- No duplicate scenario names
