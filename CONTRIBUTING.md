# Contributing

## Local Development
- Install: `npm install`
- Check: `npm run check`
- Test: `npm test`

## Rules
- Keep changes small and cohesive.
- Avoid `any` unless absolutely needed.
- No inline or dynamic imports.
- Relative imports include `.js` extension.
- Keep commit messages as clear summaries (do not use prompt-only commit subjects).
- For substantial agent-generated changes, include a reproducibility prompt in the PR description (or a `Repro-Prompt:` commit trailer when no PR is used).
