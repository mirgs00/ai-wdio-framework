#!/usr/bin/env bash
# fix-tracked-files.sh
# ─────────────────────────────────────────────────────────────────────────────
# Run this ONCE after applying the new .gitignore to stop tracking files that
# were committed before the ignore rules existed.
#
# What it does:
#   - Removes files from the git index (stops tracking them) without deleting
#     them from your working directory.
#   - After running, commit the result: git commit -m "chore: untrack .env,
#     compiled output, and dev artefacts"
#
# I-01: .env (security) ── stop tracking the committed .env
# I-02: wdio.conf.js    ── compiled output should not live in the repo
# I-03: generate_output.log / commit_message.txt (already in .gitignore but
#        still tracked because they were committed before the rule was added)
# I-18: eslint.config.js ── remove conflicting flat-config file
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

echo "🔍  Checking which files are currently tracked..."

untrack() {
  local file="$1"
  if git ls-files --error-unmatch "$file" 2>/dev/null; then
    echo "  ✂  Untracking: $file"
    git rm --cached "$file"
  else
    echo "  ✓  Already untracked (or missing): $file"
  fi
}

# I-01
untrack .env

# I-02
untrack wdio.conf.js

# I-03
untrack generate_output.log
untrack commit_message.txt

# I-18
untrack eslint.config.js

echo ""
echo "✅  Done. Review the changes with: git status"
echo ""
echo "Next steps:"
echo "  1. git add .gitignore .env.example"
echo "  2. git commit -m 'chore: untrack .env, compiled output, and dev artefacts'"
echo "  3. git push"
echo ""
echo "⚠️  If .env contained real secrets, rotate them now — they are in git history."
echo "    Use: git filter-repo or BFG Repo Cleaner to scrub history if needed."
