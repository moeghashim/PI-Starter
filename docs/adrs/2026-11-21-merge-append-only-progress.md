---
summary: "Keep parallel progress entries with single-line entries and the Git union merge driver"
read_when:
  - Changing the progress log, its entry format, or integration workflow.
---

# Merge the Append-Only Progress Log

## Status

Accepted

## Context

Two task branches often append entries at the same place in `progress.md`. Git treats the overlapping additions as a conflict even though both entries belong in the log.

The built-in union merge driver resolves that conflict by keeping the lines from both sides, but it works on lines, not entries. Git first refines the conflicting region: a run of more than three identical lines on both sides is treated as already merged and emitted once. Multiline entries share such runs whenever two branches have the same actor and the same leading changed paths. The merge then reports no conflict while one entry loses its shared lines and the other absorbs lines from both, which also rewrites text already in the log.

## Decision

Set `merge=union` on `progress.md`, and have `scripts/progress-log.mjs` write each new entry as one physical line: a list item with a bold timestamp and the fields separated by `<br>`. Whitespace inside a field collapses to single spaces, and `&`, `<`, and `>` are written as HTML entities so field text cannot turn into markup.

An entry that is one line cannot share a partial run of lines with another entry, so the union driver keeps each parallel entry whole and leaves the existing log as an unchanged prefix. Keep the append-only check in place.

## Consequences

Concurrent entries follow merge order. Read their timestamps for time order. The driver applies to Git merges that honor repository attributes.

Entries written before this decision stay multiline and are never rewritten. The guarantee covers entries appended through `scripts/progress-log.mjs`; a hand-written multiline entry on parallel branches can still be interleaved.

## Alternatives Considered

The union driver alone, with multiline entries, silently corrupts entries as described above.

An entry file per branch would need a separate step to assemble the log and a new commit workflow. A custom merge driver that concatenates whole entries would need Git configuration in every clone. Single-line entries keep the current log, commit workflow, and built-in driver.
