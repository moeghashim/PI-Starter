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
- `progress.md` is append-only; only add new entries at the end.
- For agent-requested commits, use `npm run commit:with-progress -- "<message>" --learning "<learning>" -- "<path>" ...`.
- For release commands, pass `--learning`, for example: `npm run release:patch -- --learning "What we learned from this release."`.
- Keep commit messages as clear summaries (do not use prompt-only commit subjects).
- For substantial agent-generated changes, include a reproducibility prompt in the PR description (or a `Repro-Prompt:` commit trailer when no PR is used).
