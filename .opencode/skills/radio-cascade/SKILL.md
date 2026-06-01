---
name: radio-cascade
description: Use when testing web pages with cascading radio buttons where selecting one radio reveals additional radios or inputs. Use when debugging generated @radio-matrix scenarios, or when manually exploring a page to understand its radio button transition graph.
---

# Radio Cascade Testing Skill

You are testing a web page with **cascading radio buttons** — selecting one radio
option makes new form elements (more radios, text inputs, selects) appear.

## Workflow

### 1. Start session and navigate

```
start_session({platform: 'browser', headless: true})
navigate({url: '<target-url>'})
```

### 2. Initial scan — identify radio groups

```
get_elements({inViewportOnly: true})
```

Look for `<input type="radio">` elements. Note their `name` attributes to
identify radio groups (elements sharing the same `name` are mutually exclusive).

### 3. Explore each option — scan → click → re-scan

For each radio option in a group:

1. Record the current element list as the **baseline**
2. `click_element({selector: '<radio-selector>'})`
3. Wait briefly (the page may need time to render new elements)
4. `get_elements({inViewportOnly: true})`
5. **Diff** the new element list against the baseline — look for elements that
   appeared only after the click
6. If new **radio buttons** appeared:
   - They represent the next cascade level
   - Repeat step 3 for each new radio option (recursive exploration)
7. If new **text inputs / selects** appeared:
   - They need form data before submit
   - Note their `type`, `name`, and `placeholder` for context-aware values
8. If no new elements appeared:
   - This is a terminal radio selection
   - Proceed to form fill + submit

### 4. Build the scenario chain

For each complete path from root radio → terminal selection:

```
Given the user navigates to "<url>"
When the user clicks "<radio-1>"
When the user clicks "<radio-2>"       // if cascaded
When the user fills "<input>" with "<value>"  // if new inputs appeared
When the user submits the form
Then the page title should contain "..."
Then the URL should contain "..."
```

### 5. Combinatorial matrix generation

When there are multiple options at each level, create scenarios for **every
combination**:

- Level 1: options A, B, C
- Level 2 (after A): options A1, A2
- Level 2 (after B): option B1 (text input)
- Level 2 (after C): options C1, C2, C3

Produces: A→A1, A→A2, B→B1, C→C1, C→C2, C→C3 (6 scenarios)

For deeper cascades (level 3+), continue the same pattern.

## Element Detection Tips

- After clicking a radio, new elements may be:
  - Hidden in the DOM initially (`display: none`)
  - Dynamically injected via JavaScript
  - Revealed by removing a `hidden` attribute or CSS class
- Use `get_elements` with `inViewportOnly: false` if new elements exist but
  are scrolled out of view
- Use `scroll({direction: 'down'})` before re-scanning if the page is long
- The `get_accessibility_tree` tool can sometimes find elements that
  `get_elements` misses (e.g., custom-styled radio buttons using `role="radio"`)

## Form Fill Values

When new text inputs appear after a radio selection, use context-appropriate
values based on the input's type, name, and placeholder:

| Input type | Suggestion |
|-----------|-----------|
| `email` | `test_<timestamp>@test.com` |
| `password` | `TestPass123!` |
| `tel` / `phone` | `1234567890` |
| `number` / `value` / `amount` | `500000` |
| `name` | `Test User` |
| `text` (generic) | `test` |

## Verifying the Generated Scenarios

After building the chain, you can verify it matches what the flow-matrix engine
would generate offline:

```bash
npx ts-node src/cli.ts <url> --max-radio-depth <N>
```

The generated feature file (`src/features/generated_*.feature`) will contain
both `@radio-variant` (single-level) and `@radio-matrix` (multi-level) scenarios.

## Error Recovery

- If `click_element` fails: the radio may be hidden behind an overlay. Try
  `execute_script({script: "document.querySelector('<selector>').click()"})`
- If new elements don't appear: the page may need a short pause.
  Use `execute_script({script: "await new Promise(r => setTimeout(r, 1000))"})`
- If form submit fails: check that all visible required fields have values.
- Always call `close_session()` when done.
