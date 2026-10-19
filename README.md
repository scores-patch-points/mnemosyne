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
    kinds   := 0x01 GROUND  0x02 DMD  0x03 WINDOW  0x04 MARGINS     (unknown kinds are skipped by length)

Append is the only write. Changing or removing any byte breaks the chain from that record on.

## What is in it now

One domain, `udhr-core`: the Universal Declaration of Human Rights read in 515 editions, co-equal, as one structure of nameless referents. 7 records, 735 bytes: four DMD records (edition 1 sets the structure, then only the preamble moves), the stable window, the margins (how many editions must go before any unit's structure moves), and the ground (charter root `18aa32ed202156bb6132c954091dfb5c`).

## Not here

The code that produces a domain's records lives with that domain. For `udhr-core` it is not yet in a repository; `GLAUCA-EOT.md` in scores-patch-points/penelope (GL-UD-01 to GL-UD-06) says what it found and what would falsify it. The surprise model is `surprise.mjs`: a Dirichlet-categorical per unit with a declared prior (alpha 1, K 40); magnitudes depend on it, which records exist does not.
