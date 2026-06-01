# @wdio/mcp Browser Automation Tools

Available MCP tools for browser automation:

| Tool | Purpose | Arguments |
|------|---------|-----------|
| `start_session` | Start browser session | `{platform: 'browser', browser?: 'chrome'|'firefox'|'edge'|'safari', headless?: boolean, windowWidth?: number, windowHeight?: number}` |
| `close_session` | Close current session | `{detach?: boolean}` |
| `navigate` | Go to a URL | `{url: string}` |
| `get_elements` | List visible interactable elements | `{inViewportOnly?: boolean, includeContainers?: boolean}` |
| `get_accessibility_tree` | Get accessibility tree | `{role?: string, limit?: number, offset?: number}` |
| `click_element` | Click an element | `{selector: string}` |
| `set_value` | Type into an input | `{selector: string, value: string}` |
| `get_screenshot` | Capture screenshot | (none) |
| `execute_script` | Run arbitrary JS | `{script: string, args?: any[]}` |
| `scroll` | Scroll the page | `{direction: 'up'|'down', pixels?: number}` |
| `switch_tab` | Switch browser tab | `{handle?: string, index?: number}` |
| `get_cookies` | List cookies | `{name?: string}` |

Standard workflow:
1. `start_session({platform: 'browser', headless: true})`
2. `navigate({url: '...'})`
3. `get_elements({inViewportOnly: true})` to inspect the page
4. Interact via `click_element`, `set_value`, etc.
5. `close_session()` when done
