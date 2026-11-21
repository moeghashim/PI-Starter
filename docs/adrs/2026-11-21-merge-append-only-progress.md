---
summary: "Keep parallel progress entries with the Git union merge driver"
read_when:
  - Changing the progress log or integration workflow.
---

# Merge the Append-Only Progress Log

## Status

Accepted

## Context

Two task branches often append entries at the same place in `progress.md`. Git treats the overlapping additions as a conflict even though both entries belong in the log.

## Decision

Set `merge=union` on `progress.md`. Git can keep both additions during a merge, and the file remains the single tracked log. Keep the append-only check in place.

## Consequences

Concurrent entries follow merge order. Read their timestamps for time order. The driver applies to Git merges that honor repository attributes.

## Alternatives Considered

An entry file per branch would need a separate step to assemble the log. The built-in driver keeps the current log and commit workflow.
