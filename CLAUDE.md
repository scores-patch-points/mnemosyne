# mnemosyne: the system's mind: one hash-chained log

> Generated from the nexus manifest (`scores-patch-points/nexus`). Do not edit by hand: change `nexus/nexus.json` or `nexus/cards/mnemosyne.md` in the map repo and regenerate; the map's tests catch drift.

You are in one repo of the **nexus** (`scores-patch-points`): an interconnected body with **no wrong door**. Whichever repo you enter, you can learn the whole from it. The map: https://github.com/scores-patch-points/scores-patch-points. Its place on the map is PROPOSED; the owner has not confirmed it.

## What this repo is
Level `L2-satellite`. Default branch `main`.

*`scores-patch-points/mnemosyne`*

- **Does:** `mind.eot`: one file, one hash chain, one writer at a time (append through a
  PR so the chain never forks), recording only the differences that make a difference
  as what was read changed the reader's conclusions; one immutable core, the Universal
  Declaration of Human Rights (the first records, pinned by `core.json`). Tools:
  `node eotm-cli.mjs mind.eot` (dump) and `... verify` (check the chain); test
  `node --test eotm.test.mjs`.
- **Doesn't include:** a library, a record of what sources say, or a second log or
  per-domain file (one log, many readings).
- **Finds at:** `README.md`; `core.json`; `eotm-cli.mjs`; `eotm.test.mjs`.

## Doors, gate, siblings
- Doors:
  - `node eotm-cli.mjs mind.eot [verify]`
- Gate (run it before you finish): `node --test eotm.test.mjs`
- Siblings: none declared

## Rules in every repo of the nexus
1. Respect the boundary. If a repo's "Doesn't include" names your thing, it belongs in another holon: put it in the smallest holon whose boundary includes it.
2. A typed gap beats a guess. An unknown repo, door, gate, prior or dataset is stated as a gap. A missing sibling or prior is a refusal that says how to get it, never a silent degrade.
3. Start from the default branch of origin, not a stale branch, and say which commit you read.
4. Read and write through the repo's declared door. Do not build a second reader or a second door beside it.
5. Do not push, merge or change user-level configuration without the owner's yes. Commit only paths you can name.
6. Quote every number with its split (dev, fresh, held-out, reused, exploratory) and its stamp. A measure that changed is a new row or a recorded pin, never the same number under the same name.
7. A negative result is a finding: record it with its falsifier.
8. Language is read by the reader, never by a pattern: a sentence, a question, a name or a relation goes through the reader's rows (its UD codec) to marks in EOT, and matching and reasoning happen on those marks, never on surface strings; a language with no codec is a typed gap, never English by default. Carry the text-regex ratchet (the count of regex applications may not grow); a pattern on a path, hash, id or file format is declared `// regex-ok: <why it is not language>`.

## Before you start
- `git fetch`; work from `origin/main` and name the commit you read.
- The research rules and what is already established: https://raw.githubusercontent.com/scores-patch-points/penelope/main/BRIEF.md.
