import type { WordKind, WordLessonSetup } from "./types";
import { TEMPLATES_BY_TYPE, type WordTemplate } from "./wordTemplates";
import type { GenContext, WordProblem } from "./wordTypes";

function shuffle<T>(arr: T[]): T[] {
  // Fisher-Yates, mutates a copy.
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

/**
 * Build a stratified queue: each template appears `floor(rounds/n)` times,
 * with the remainder distributed one extra to the first `rounds % n`
 * templates. Then shuffled. Per-template counts in a round are kept tight
 * (delta ≤ 1 across templates), unlike pure uniform random which lets one
 * template dominate by chance.
 */
function balancedQueue(
  pool: readonly WordTemplate[],
  rounds: number,
): WordTemplate[] {
  if (pool.length === 0) return [];
  const baseEach = Math.floor(rounds / pool.length);
  const extras = rounds % pool.length;
  const list: WordTemplate[] = [];
  for (let i = 0; i < pool.length; i++) {
    const t = pool[i] as WordTemplate;
    const count = baseEach + (i < extras ? 1 : 0);
    for (let j = 0; j < count; j++) list.push(t);
  }
  return shuffle(list);
}

/**
 * Pool the template families for every selected kind, de-duplicated and in the
 * order given. A single-kind lesson passes a one-element list; a "mixed" lesson
 * (e.g. mass + volume, or several word-problem types) just lists them all —
 * there are no special combo kinds.
 */
function poolFor(wordKinds: readonly WordKind[]): readonly WordTemplate[] {
  const seen = new Set<string>();
  const pool: WordTemplate[] = [];
  for (const kind of wordKinds) {
    for (const t of TEMPLATES_BY_TYPE[kind]) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        pool.push(t);
      }
    }
  }
  return pool;
}

function isSameProblem(a: WordProblem, b: WordProblem): boolean {
  if (a.templateId !== b.templateId) return false;
  if (a.numbers.length !== b.numbers.length) return false;
  for (let i = 0; i < a.numbers.length; i++) {
    if (a.numbers[i] !== b.numbers[i]) return false;
  }
  // Vars (names/nouns) intentionally ignored — different actors with the same
  // template + numbers is "the same problem" pedagogically. This forces real
  // numerical variety, not just cosmetic name swaps.
  return true;
}

/**
 * Stateful word-problem generator. One instance per round; the round runner
 * calls `.next(prev)` once per advance.
 *
 * Stateful (rather than the stateless `generateProblem(op, setup, prev)` used
 * for arith) because per-type lessons promise stratified template distribution
 * — that requires a queue that survives across calls.
 */
export class WordGenerator {
  private readonly pool: readonly WordTemplate[];
  private readonly rounds: number;
  private readonly ctx: GenContext | undefined;
  private queue: WordTemplate[];

  constructor(setup: WordLessonSetup) {
    this.pool = poolFor(setup.wordKinds);
    this.rounds = setup.rounds;
    // Grade-scoping context, if the lesson declares one. Passed to every
    // template's generate() so range-aware templates can scale.
    this.ctx =
      setup.maxNumber !== undefined
        ? { maxNumber: setup.maxNumber }
        : undefined;
    this.queue = balancedQueue(this.pool, this.rounds);
  }

  next(prev: WordProblem | null = null): WordProblem {
    if (this.queue.length === 0) {
      // Time-mode rounds run beyond the planned count; refill from the pool.
      this.queue = balancedQueue(this.pool, Math.max(1, this.pool.length));
    }
    const template = this.queue.shift() as WordTemplate;
    let candidate = template.generate(this.ctx);
    // Try a few resamples of the same template to dodge an immediate repeat.
    // We don't switch templates here because that would skew the stratified
    // queue we just promised.
    for (let tries = 0; tries < 20; tries++) {
      if (!prev || !isSameProblem(candidate, prev)) return candidate;
      candidate = template.generate(this.ctx);
    }
    return candidate;
  }
}
