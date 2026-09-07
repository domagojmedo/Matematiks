/**
 * Generate `src/lib/reading/readingStories.ts` from the story markdown in
 * `docs/specs/2026-09-04-reading-stories-batch-*.md`.
 *
 *   node scripts/build-reading-stories.mjs
 *
 * The markdown is the source of truth: it is what a native speaker reviews and
 * edits. Re-run this after any content change rather than hand-editing the
 * generated file.
 *
 * Expected shape per story:
 *
 *   ## Title
 *   Sentence.
 *   Sentence.
 *
 *   Sentence in a second paragraph.
 *
 *   *Question?* → **correct option** / wrong / wrong
 */

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SPECS_DIR = "docs/specs";
const OUT_FILE = "src/lib/reading/readingStories.ts";

/** Levels for the single-level batch files that carry no `# Level N` heading. */
const FILE_LEVEL = {
  "2026-09-04-reading-stories-batch-2.md": 4,
  "2026-09-04-reading-stories-batch-3.md": 5,
  "2026-09-04-reading-stories-batch-4.md": 6,
  "2026-09-04-reading-stories-batch-7.md": 5,
  "2026-09-04-reading-stories-batch-8.md": 6,
};

const DIACRITICS = { č: "c", ć: "c", đ: "d", š: "s", ž: "z" };

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[čćđšž]/g, (ch) => DIACRITICS[ch])
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Every question in the markdown lists the correct answer first, because that
 * is how it is readable for a human reviewer. Left alone, that would teach a
 * child to always tap the first option, so positions are shuffled here.
 *
 * The shuffle is seeded on story id + question index: stable across
 * regenerations (no churn in the diff) but varied across questions. The
 * reading screen shuffles again per attempt, so a re-read of the same story
 * cannot be answered from memory of where the answer sat.
 */
function seededOrder(seed, length) {
  let state = 0;
  for (let i = 0; i < seed.length; i++) {
    state = (state * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const order = Array.from({ length }, (_, i) => i);
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** `*Prompt?* → **right** / wrong / wrong` */
function parseQuestion(line) {
  const match = line.match(/^\*(.+?)\*\s*→\s*(.+)$/);
  if (!match) return null;
  const prompt = match[1].trim();
  const options = match[2].split(" / ").map((option) => option.trim());
  const expectedIndex = options.findIndex((option) => option.startsWith("**"));
  if (expectedIndex === -1) {
    throw new Error(`No option marked correct: ${line}`);
  }
  return {
    prompt,
    options: options.map((option) => option.replace(/\*\*/g, "").trim()),
    expectedIndex,
  };
}

function parseFile(fileName) {
  const text = readFileSync(join(SPECS_DIR, fileName), "utf8");
  const stories = [];
  let level = FILE_LEVEL[fileName] ?? null;
  let current = null;
  let paragraph = [];

  const flushParagraph = () => {
    if (current && paragraph.length > 0) {
      current.paragraphs.push(paragraph);
      paragraph = [];
    }
  };
  const flushStory = () => {
    flushParagraph();
    if (current) stories.push(current);
    current = null;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    const levelHeading = line.match(/^#\s+Level\s+(\d)\s*$/i);
    if (levelHeading) {
      flushStory();
      level = Number(levelHeading[1]);
      continue;
    }

    if (line.startsWith("## ")) {
      flushStory();
      const title = line.slice(3).trim();
      if (level === null) {
        throw new Error(`Story "${title}" in ${fileName} has no level`);
      }
      current = {
        id: slugify(title),
        level,
        title,
        paragraphs: [],
        questions: [],
      };
      continue;
    }

    if (current === null) continue;

    if (line === "") {
      flushParagraph();
      continue;
    }
    // A horizontal rule ends a story; so does any other heading.
    if (line.startsWith("---") || line.startsWith("#")) {
      flushStory();
      continue;
    }
    if (line.startsWith("|") || line.startsWith(">")) continue;

    if (line.startsWith("*")) {
      const question = parseQuestion(line);
      if (question) {
        flushParagraph();
        current.questions.push(question);
        continue;
      }
    }

    paragraph.push(line);
  }
  flushStory();
  return stories;
}

const files = readdirSync(SPECS_DIR)
  .filter((name) => /reading-stories-batch-\d+\.md$/.test(name))
  .sort();

const stories = files.flatMap(parseFile);

for (const story of stories) {
  story.questions = story.questions.map((question, qIndex) => {
    const order = seededOrder(`${story.id}#${qIndex}`, question.options.length);
    return {
      prompt: question.prompt,
      options: order.map((i) => question.options[i]),
      expectedIndex: order.indexOf(question.expectedIndex),
    };
  });
}

const seen = new Map();
for (const story of stories) {
  if (seen.has(story.id)) {
    throw new Error(`Duplicate story id "${story.id}" (${story.title})`);
  }
  seen.set(story.id, story);
  if (story.paragraphs.length === 0) {
    throw new Error(`Story "${story.title}" has no sentences`);
  }
  if (story.questions.length === 0) {
    throw new Error(`Story "${story.title}" has no questions`);
  }
}

const byLevel = {};
for (const story of stories) {
  byLevel[story.level] = (byLevel[story.level] ?? 0) + 1;
}

const header = `// GENERATED FILE — do not edit by hand.
// Source: ${SPECS_DIR}/2026-09-04-reading-stories-batch-*.md
// Regenerate: node scripts/build-reading-stories.mjs
//
// ${stories.length} stories — ${Object.entries(byLevel)
  .map(([level, count]) => `L${level}: ${count}`)
  .join(" · ")}

import type { Story } from "./readingTypes";

export const STORIES: Story[] = `;

writeFileSync(
  OUT_FILE,
  `${header}${JSON.stringify(stories, null, 2)};\n`,
  "utf8",
);

// Hand the output to Biome. Raw JSON.stringify is not what the repo formatter
// produces, so without this a regeneration that changed no content still shows
// a four-thousand-line diff and fails `npm run check` — which would make the
// "regenerate after editing the markdown" instruction in the header useless.
// Run Biome's Node entry point with the current interpreter: no shell (passing
// args through one is deprecated in Node) and no platform branch, which the
// `.bin` shims would need since Windows cannot exec a `.cmd` directly.
const biome = join("node_modules", "@biomejs", "biome", "bin", "biome");
try {
  execFileSync(process.execPath, [biome, "format", "--write", OUT_FILE], {
    stdio: "ignore",
  });
} catch {
  console.warn(`Could not run Biome on ${OUT_FILE}; run npm run format.`);
}

console.log(`${stories.length} stories → ${OUT_FILE}`);
for (const [level, count] of Object.entries(byLevel)) {
  console.log(`  level ${level}: ${count}`);
}
