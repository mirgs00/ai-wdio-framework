# Plan: Fix Fragile Selector Generation

## Goal
Improve `getSelector()` in `src/utils/flow-matrix/stateExplorer.ts` to produce stable, resilient CSS selectors by expanding the priority chain and removing fragile positional fallbacks.

## Changes

### 1. Replace `getSelector` (lines 186–201)

**Current behavior:** Checks `id`, then `data-qa`, then falls back to recursive positional (`nth-child`) — produces fragile selectors like `html > body:nth-child(1) > div:nth-child(3) > form:nth-child(1) > input:nth-child(2)`.

**New priority chain (10 levels, best → last resort):**

| # | Strategy | Example |
|---|----------|---------|
| 1 | `#id` | `#username` |
| 2 | `data-test` / `data-testid` | `[data-test="login-btn"]` |
| 3 | `data-qa` | `[data-qa="submit"]` |
| 4 | `aria-label` | `[aria-label="Search"]` |
| 5 | `name` | `input[name="email"]` |
| 6 | `title` | `button[title="Submit"]` |
| 7 | `a[href]` (relative/internal only) | `a[href="/login"]` |
| 8 | Unique class chain | `.btn-primary.active` |
| 9 | Input attribute combo | `input[type="text"][name="email"]` |
| 10 | `nth-child` via best-possible parent | `#login-form > div:nth-child(2) > input:nth-child(1)` |

**Key improvement:** Step 10 recursively calls the **new** `getSelector` for the parent — so a child of `#login-form` produces `#login-form > input:nth-child(2)` instead of `html > body > div > form > input`.

### 2. Simplify per-tag inline logic (lines 212–238)

**Current:** Each tag (`a`, `button`, `input`, `select`, `textarea`, `form`) has its own selector-building logic that partially duplicates `getSelector`.

**New:** Replace all per-tag branches with a single `getSelector(el)` call. Only keep the `input[type="hidden"]` early skip.

Before (32 lines):
```typescript
let selector: string
if (tag === 'a' || tag === 'button') {
  selector = getSelector(el)
} else if (tag === 'input') {
  const input = el as HTMLInputElement
  if (input.type === 'hidden') continue
  if (input.id) selector = `#${CSS.escape(input.id)}`
  else if (input.name) selector = `${tag}[name="${CSS.escape(input.name)}"]`
  else if (input.getAttribute('data-qa')) {
    selector = `[data-qa="${CSS.escape(input.getAttribute('data-qa')!)}"]`
  } else selector = getSelector(el)
} else if (tag === 'select' || tag === 'textarea') {
  ...
}
```

After (3 lines):
```typescript
if (tag === 'input' && (el as HTMLInputElement).type === 'hidden') continue
const selector = getSelector(el)
```

## Files Modified
- `src/utils/flow-matrix/stateExplorer.ts` — `getSelector()` function + inline selector logic

## Verification
```bash
npm run lint    # ESLint — should pass with no errors
npx tsc --noEmit  # TypeScript — should pass with no errors
```

## Risk Assessment
- **Low risk:** `getSelector` is contained within `scanInteractiveElements`, which runs inside `ctx.execute()` (browser sandbox). No other code depends on the exact selector format.
- **Backward compatibility:** All upstream consumers (clickElement, fillForm, pageObjectBuilder, scenarioExtractor) use the resulting selector string — they don't care about its format.
- **Test impact:** Selectors will change for some discovered elements. Previously: `html > body > div > form > input:nth-child(1)`. Now: `#login-form > input:nth-child(1)` or `input[name="username"]`. This is strictly better.
