// udhr-core/surprise.mjs — Bayesian surprise (Itti & Baldi): how far an observation moves the model, KL(posterior || prior).
// The model is deliberately the plainest one that can be wrong in the way we care about: for each unit, a categorical
// over its paragraph count with a symmetric Dirichlet prior. One edition is one observation per unit; the surprise of
// reading it is the sum over units of KL(Dir(post) || Dir(prior)), in bits.
// DECLARED PRIOR (a modelling choice, stated, not tuned): alpha = 1 per category (Laplace), K = 40 categories (counts 0..39;
// the data use 1..19). The magnitude of a surprise depends on K and alpha; which steps change the conclusion does not.
export const ALPHA = 1, K = 40;

function lgamma(x) {                                          // Lanczos, g=7, n=9
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  x -= 1;
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  let a = c[0]; const t = x + g + 0.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
function digamma(x) {
  let r = 0;
  while (x < 6) { r -= 1 / x; x += 1; }
  const f = 1 / (x * x);
  return r + Math.log(x) - 0.5 / x - f * (1 / 12 - f * (1 / 120 - f * (1 / 252 - f * (1 / 240 - f / 132))));
}
/** KL( Dir(a') || Dir(a) ) in nats. */
export function klDirichlet(a2, a1) {
  const s2 = a2.reduce((x, y) => x + y, 0), s1 = a1.reduce((x, y) => x + y, 0);
  let kl = lgamma(s2) - lgamma(s1);
  for (let i = 0; i < a1.length; i++) kl += lgamma(a1[i]) - lgamma(a2[i]) + (a2[i] - a1[i]) * (digamma(a2[i]) - digamma(s2));
  return kl;
}
export const bits = (nats) => nats / Math.LN2;

/** A running model over units. observe(unitCounts: Map(unit -> paragraphCount)) -> surprise in bits for that one edition. */
export function makeModel(units) {
  const alpha = new Map(units.map((u) => [u, new Array(K).fill(ALPHA)]));
  return {
    alpha,
    observe(counts) {
      let nats = 0;
      for (const [u, c] of counts) {
        const a = alpha.get(u); if (!a || c < 0 || c >= K) continue;
        const next = a.slice(); next[c] += 1;
        nats += klDirichlet(next, a);
        alpha.set(u, next);
      }
      return bits(nats);
    },
  };
}

/** KL( Beta(a2,b2) || Beta(a1,b1) ) in nats. */
export function klBeta(a2, b2, a1, b1) {
  const lB = (a, b) => lgamma(a) + lgamma(b) - lgamma(a + b);
  return lB(a1, b1) - lB(a2, b2) + (a2 - a1) * digamma(a2) + (b2 - b1) * digamma(b2) + (a1 - a2 + b1 - b2) * digamma(a2 + b2);
}
/** A Bernoulli model per item over a FIXED universe: is this item carried by an edition? Prior Beta(1,1). observe(Set of carried items) -> bits. */
export function makeCarryModel(universe) {
  const ab = new Map([...universe].map((x) => [x, [1, 1]]));
  return {
    ab,
    observe(carried) {
      let nats = 0;
      for (const [x, [a, b]] of ab) { const next = carried.has(x) ? [a + 1, b] : [a, b + 1]; nats += klBeta(next[0], next[1], a, b); ab.set(x, next); }
      return bits(nats);
    },
  };
}
