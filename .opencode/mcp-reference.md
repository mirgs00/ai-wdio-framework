# MCP Servers — Available Tools

## @wdio/mcp — Browser & Mobile Automation

| Tool | Purpose | Key Arguments |
|------|---------|---------------|
| `start_session` | Start browser/mobile session | `{platform, browser?, headless?, deviceName?, appPath?}` |
| `close_session` | Close current session | `{detach?}` |
| `navigate` | Go to a URL | `{url}` |
| `get_elements` | List visible interactable elements | `{inViewportOnly?, includeContainers?}` |
| `get_accessibility_tree` | Get accessibility tree | `{role?, limit?, offset?}` |
| `click_element` | Click an element | `{selector, scrollToView?}` |
| `set_value` | Type into an input | `{selector, value}` |
| `get_screenshot` | Capture screenshot | (none) |
| `execute_script` | Run arbitrary JS | `{script, args?}` |
| `scroll` | Scroll the page | `{direction, pixels?}` |
| `switch_tab` | Switch browser tab | `{handle?, index?}` |
| `switch_frame` | Switch into an iframe | `{selector?}` |
| `get_cookies` | List cookies | `{name?}` |
| `set_cookie` | Set a cookie | `{name, value, domain?}` |
| `delete_cookies` | Delete cookies | `{name?}` |
| `get_tabs` | List browser tabs | (none) |
| `launch_chrome` | Launch Chrome with remote debug | `{port?, mode?}` |
| `emulate_device` | Emulate mobile device | `{device}` |
| `set_geolocation` | Override GPS coordinates | `{latitude, longitude}` |
| `get_contexts` | List automation contexts (mobile) | (none) |
| `switch_context` | Switch native/webview context | `{context}` |
| `swipe` | Swipe screen (mobile) | `{direction, duration?}` |
| `tap_element` | Tap element (mobile) | `{selector}` |
| `hide_keyboard` | Dismiss keyboard (mobile) | (none) |
| `rotate_device` | Rotate device (mobile) | `{orientation}` |
| `get_app_state` | Get app state (mobile) | `{bundleId}` |
| `drag_and_drop` | Drag element (mobile) | `{sourceSelector, targetSelector?}` |
| `upload_app` | Upload app to BrowserStack | `{path, customId?}` |
| `list_apps` | List BrowserStack apps | `{limit?}` |

### Standard Browser Workflow
1. `start_session({platform: 'browser', headless: true})`
2. `navigate({url: '...'})`
3. `get_elements({inViewportOnly: true})` to inspect
4. Interact via `click_element`, `set_value`, etc.
5. `close_session()` when done

### Standard Mobile Workflow
1. `start_session({platform: 'android', deviceName: '...', appPath: '...'})`
2. `get_elements()` to inspect the screen
3. Interact via `click_element`, `set_value`, `swipe`, etc.
4. `close_session()` when done

---

## @modelcontextprotocol/server-sequential-thinking — Deep Reasoning

Deep, step-by-step reasoning for complex debugging and planning.

| Tool | Purpose |
|------|---------|
| `sequential_thinking` | Think step-by-step with reflection and branching |

Use when debugging complex test failures, planning test generation strategies, or tracing DOM analysis chains.

---

## @modelcontextprotocol/server-memory — Persistent Knowledge Graph

Stores and retrieves information across sessions using a knowledge graph.

| Tool | Purpose |
|------|---------|
| `add_memory` | Add a memory entry |
| `query_memory` | Search memories |
| `get_memory` | Get specific memory |
| `update_memory` | Update a memory |
| `delete_memory` | Delete a memory |
| `list_memories` | List recent memories |

Use for remembering flaky selectors, healing patterns, DOM structures, and project conventions across sessions. Data persists in `memory.jsonl`.

---

## @modelcontextprotocol/server-filesystem — File Operations

Sandboxed file access (restricted to project directory).

| Tool | Purpose |
|------|---------|
| `read_file` | Read a file |
| `write_file` | Write a file |
| `edit_file` | Edit file contents |
| `search_files` | Search files by pattern/content |
| `list_directory` | List directory contents |
| `create_directory` | Create a directory |
| `move_file` | Move/rename a file |
| `copy_file` | Copy a file |
| `get_file_info` | Get file metadata |

Restricted to: workspace root (`.` — relative, portable across machines)

---

## @modelcontextprotocol/server-github — GitHub Repository Management

GitHub API operations via the official MCP server (26 tools). Runs through Code Mode, so call as `tools.github.<tool>(...)`.

| Tool Category | Examples |
|---|---|
| **Issues** | `create_issue`, `get_issue`, `add_issue_comment` |
| **Commits / Code** | `list_commits`, `search_code`, `get_file_contents` |
| **Repos** | `get_repository`, `list_repositories`, `create_repository` |
| **PRs** | `create_pull_request`, `get_pull_request`, `list_pull_requests` |

Requires `GITHUB_PERSONAL_ACCESS_TOKEN` env var (substituted via `{env:GITHUB_PERSONAL_ACCESS_TOKEN}` in `opencode.json`).

---
---

## ollama-mcp — Local LLM Integration

Interact with local Ollama instance for prompt testing and model management.

| Tool | Purpose |
|------|---------|
| `ollama_chat` | Chat with a model |
| `ollama_generate` | Generate completion |
| `ollama_list_models` | List available models |
| `ollama_pull_model` | Pull a model |
| `ollama_delete_model` | Delete a model |
| `ollama_show_model` | Show model details |
| `ollama_embed` | Generate embeddings |

Connects to `http://localhost:11434` by default.

---

## Cross-Server Workflow Examples

### Debug a Failing Radio Cascade

1. `start_session({platform: 'browser', headless: true})`
2. `navigate({url: '<target>'})`
3. `get_elements()` — inspect the page
4. `sequential_thinking` — trace the cascade logic, hypothesize what's broken
5. `ollama_chat` — ask what selectors to use for the radio group
6. `click_element` + `get_elements` — test the hypothesis
7. `close_session()`

### Heal a Broken Selector with Memory

1. `query_memory({query: "originalSelector: '#broken-btn'"})` — check past healings
2. If found: apply the remembered selector directly
3. If not found: `start_session` + `get_elements` to discover the new element
4. `memory_create_entities` — persist the new healing for next time
5. `close_session()`

### Auto-PR Generated Tests

Local git operations (checkout, add, commit, push) are done via the shell, not MCP. GitHub MCP tools are then used for PR/issue management:

1. `git checkout -b test-gen/example-com` (shell)
2. `git add src/features/ src/page-objects/ src/step-definitions/ && git commit -m "test: auto-generate scenarios"` (shell)
3. `git push -u origin test-gen/example-com` (shell)
4. `tools.github.create_pull_request(...)` to open the PR

---

## Agent Reference

| Agent | MCP Servers | Purpose |
|-------|-------------|---------|
| `wdio-tester` | wdio, sequential-thinking | Interactive browser testing |
| `healing-archivist` | memory, sequential-thinking | Persistent healing knowledge graph |
| `test-pr-bot` | github, filesystem | Commit and PR generated tests |
| `ollama-debugger` | ollama, wdio | LLM-assisted debugging sessions |
| `test-generator` | (none — runs CLI) | Flow-matrix test generation pipeline |
