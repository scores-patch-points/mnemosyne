# mnemosyne — the system's mind, in one binary log

`mind.eot` is the system's mind: one file, one hash chain, one writer at a time (append through a PR so the chain never forks). There is no second log and no per-domain file. It records only **differences that make a difference** (DMD, after Bateson; see `khora/native/kernel/activation.js` in scores-patch-points/khora): a record is appended only when reading something changes a conclusion, and it carries the **Bayesian surprise** of that reading (in bits) and the surprise absorbed since the last record without changing anything.

    node eotm-cli.mjs mind.eot          # dump
    node eotm-cli.mjs mind.eot verify   # check the hash chain
    node --test eotm.test.mjs   # format + surprise checks

## Format (EOTM v1)

    file    := "EOTM" version(1)  record*
    record  := kind(1)  length(varint)  payload(length)  chain(8)
    chain   := sha256(prevChain || kind || payload)[0:8]     genesis = sha256("EOTM1")[0:8]
    payload := domain(8) ...                                 domain = sha256(name)[0:8]; one log, many readings
    kinds   := 0x01 GROUND  0x02 DMD  0x03 WINDOW  0x04 MARGINS  0x05 DMDN (a DMD whose units are named by 8-byte ids)  0x06 REVISE (the same layout, caused by late evidence about an edition already read; appended only if the conclusion moved)    (unknown kinds are skipped by length)

Append is the only write. Changing or removing any byte breaks the chain from that record on.

## What is in it now

Four conclusions about the Universal Declaration of Human Rights, 85 records, 8,791 bytes (the earlier 5,615 bytes unchanged):

- **`udhr-core`** — the paragraph structure shared by 515 editions, read co-equal: four DMD records (edition 1 sets the structure, then only the preamble moves), the stable window, the margins (how many editions must go before any unit's structure moves), and the ground (charter root `18aa32ed202156bb6132c954091dfb5c`).
- **`udhr-core/propositions`** — the propositions the Declaration makes, language-independent, from the five hand-adjudicated readings (eng, spa, arb, cmn_hans, swh): four DMDN records and the ground. After the fifth edition 128 of 138 propositions are carried by more than half of them. Five witnesses is what exists, so this is hand-adjudicated wording-grain evidence, not a mechanical convergence over 515.
- **`udhr-core/beings`** — which units of the Declaration the languages themselves bind together, read with the stack's ear and heard-nominals tier (no capitals) in the 233 editions (209 language codes) whose language has a POS prior; the other 245 have none and are not read. The conclusion is the set of **mutual nearest-neighbour unit pairs** by shared beings: 9 pairs (0-26, 3-6, 4-5, 7-12, 8-10, 14-29, 15-17, 23-25, 28-30), against a shuffled-label null of at most 6 over 200 draws. The claim was fixed before the run and holds, narrowly. It is **not** a majority structure (mean share of editions agreeing on a unit's modal neighbour is 0.235, null 0.063) and it needs the whole set: the stable window is 233 of 233 in every order, the pair set still changes at edition 177, and no single edition is pivotal. 35 DMDN records. **Caveat found afterwards:** 63 of those 233 editions use a POS prior that was *projected from English through the UDHR's own parallel translation*, so the beings heard there are partly English-derived. This domain is kept as it was recorded (the log is append-only); the next domain is the corrected reading.
- **`udhr-core/beings-independent`** — the same reading restricted to the 170 editions (151 language codes) whose POS prior comes from a UD treebank (138) or Wiktionary (32), never from English projection. The same claim, fixed in advance, holds: 9 mutual pairs against a null maximum of 6. Eight pairs are identical to the all-editions set; `3-20` takes the place of `3-6`. The stable window is 170 of 170 or nearly (median 128, p95 170 over 200 orders), the pair set is still changing at edition 135 of 170, and no single edition is pivotal. 34 DMDN records. This is the beings conclusion to cite.

## Not here

The code that produces a domain's records lives with that domain. For `udhr-core` it is not yet in a repository; `GLAUCA-EOT.md` in scores-patch-points/penelope (GL-UD-01 to GL-UD-06) says what it found and what would falsify it. The surprise model is `surprise.mjs`: a Dirichlet-categorical per unit with a declared prior (alpha 1, K 40); magnitudes depend on it, which records exist does not.
