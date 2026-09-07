# Spec — Reading Module (Čitanje)

> Date: 2026-09-04 · Slug: `reading-module` · Scope: **new-feature** (new domain, multi-batch)
> Story library: batches 1–8, **140 stories, all levels at target**. L2: 10 · L3: 10 · L4: 40 · L5: 40 · L6: 40

## Summary

Add a Croatian reading-fluency track to Matematiks, aimed at kids who already know the letters but
decode slowly. The spine of the module is **connected text** — graded sentences and short stories,
written for this app. Syllable and word drills exist only as a warm-up at the two lowest levels;
from level 2 up, every level ends with a story.

Scoring is **read-aloud + tap** (parent or kid marks the item): no microphone, no ASR. Because
stories have a known word count, the headline measure is **words per minute** — the standard fluency
metric — alongside a self-marked verdict. Comprehension questions after each story are tap-one-of-N
and score themselves.

The module lives inside this app as a new top-level section on Home. Profiles, themes, i18n and the
Summary screen are reused unchanged. Reading sessions are stored under their own key so no existing
persisted math shape changes (rule §9.4).

Content is HR-only by design, like the word lessons (§9.1).

## Why levels are gated on word shape, not letter sets

A classic *početnica* introduces letters one at a time and restricts text to letters taught so far.
That is not this app: the target kid already knows the alphabet and is slow at *blending*, not at
letter recognition. Croatian is also near-phonetic — one letter, one sound — so letter identity is
not what makes a word hard.

What actually makes Croatian hard for a new reader is **word length, syllable count, and consonant
clusters** (`škola`, `zvijezda`, `čvrst`, `prst`). Levels are therefore gated on those, plus sentence
length. A kid who knows all the letters starts at level 2 or 3 and never sees the syllable drills.

| Level | Word shape | Sentence | Text at end of level |
|---|---|---|---|
| 1 | open syllables (`ma`, `te`, `pi`) | — | — |
| 2 | 2 syllables, no clusters | 3–4 words | 5-sentence story |
| 3 | 3 syllables, simple codas | 4–6 words | 8-sentence story |
| 4 | consonant clusters | 5–8 words | 10–12 sentence story |
| 5 | long words, `ije`/`je` alternation | 6–10 words | two-part story |
| 6 | unrestricted | full paragraphs | short chapter story + inference question |

## Success criteria

| ID | Outcome | Verification |
|---|---|---|
| SC1 | `syllabify()` splits Croatian words correctly, including `dž/lj/nj` digraphs and syllabic `r` | `syllabify.test.ts` — table of ~60 hand-checked words |
| SC2 | Every story passes its level constraints — no word exceeds the level max syllable count or cluster class | `readingStories.test.ts` decodability guard, run over all stories |
| SC3 | Each level has ≥5 stories, each with ≥1 comprehension question, all with a valid `expectedIndex` | `readingStories.test.ts` registry assertions |
| SC4 | A reading round runs end-to-end and writes a `ReadingSessionRecord` on finish and on leave | `useReadingRound.test.tsx` |
| SC5 | WPM is computed from actual word count and elapsed ms, and is stable across a paused round | `readingStats.test.ts` |
| SC6 | Reading history is visible and math history is byte-identical to before | storage key isolation test |
| SC7 | Every new UI string has a key in `hr.json`; reading levels are `languages: ["hr"]` | i18n parity test |
| SC8 | `tsc -b` clean, `npm test` green, `npm run check` clean | build |

## The round loop

A round is **one story** (levels 2–6), or a set of syllable cards (level 1).

The whole story is on screen, the way a page of a book is — not one flashcard at a time. The current
sentence is highlighted; the rest is dimmed but visible, so the kid keeps the context and can see
progress down the page.

1. Kid reads the highlighted sentence aloud.
2. Tap **Dalje** to advance, or **Ponovi** to mark it as a stumble and re-read.
3. Elapsed ms is recorded per sentence — this is where WPM comes from, and it shows which sentence
   the kid stalled on.
4. After the last sentence, comprehension questions appear as tap-one-of-N.
5. Summary: WPM, stumbles, questions correct.

**Exposure control** (a word shown for a fixed window, then hidden) applies only to the level 1–3
word warm-ups. It has no place in story reading, where re-reading is a feature.

## Architecture

### `src/lib/reading/` — pure, framework-free (§0.3)

- `syllabify.ts` — `syllabify(word: string): string[]`. Croatian rules: nuclei are `a e i o u` plus
  syllabic `r` (an `r` with no vowel in its cluster — `prst` is one syllable, `cr-ta` is two).
  Digraphs `dž`, `lj`, `nj` are single units and are never split. Division is onset-maximising
  (`ma-ma`, `ško-la`, `se-stra`) because that is what beginner readers are taught. Pure + tested.
- `readingLevels.ts` — the level table above as data: max syllables, cluster class, sentence length.
  This is what the decodability guard checks against, so it is the single source of difficulty truth.
- `readingStories.ts` — the story registry:
  ```ts
  type Story = {
    id: string;
    level: ReadingLevel;
    title: string;
    sentences: string[];
    questions: { prompt: string; options: string[]; expectedIndex: number }[];
  };
  ```
- `readingWords.ts` — the warm-up word/syllable pool for levels 1–3, derived from story vocabulary
  so the warm-up primes the exact words the story will use.
- `readingStats.ts` — WPM and stumble-rate computation. Pure, tested.
- `readingGen.ts` — picks the next unread story for a level, avoiding repeats across sessions.

### The decodability guard is the important test

`readingStories.test.ts` walks every sentence of every story, splits it into words, and asserts each
word satisfies its level constraints. This is what stops a level-3 story from quietly acquiring
`zvjezdica` during editing and stalling a kid mid-page. It also makes new content cheap to add
safely — write the story, run the test, and the level assignment is checked for you.

### Round mechanics: a parallel hook, not a generalised one

`useRoundMechanics` builds a `ProblemRecord`, whose `a / b / op / answer / userAnswer` are all
required numbers. A sentence has none of them. Two options were considered:

- Widen `ProblemRecord` into a discriminated union — this ripples through `Summary` and
  `SessionDetail`, which read those fields today, and touches a shape already on real devices.
- **(chosen)** Leave `useRoundMechanics` untouched and add `useReadingRound`, with its own
  `ReadingSessionRecord` under a new storage key.

The reading loop differs structurally anyway — it advances through a fixed list of sentences rather
than generating problems on demand — so there is less shared machinery than it first appears.

### Storage (additive only, §9.4)

New profile keys: `readingSessions`, `lastReadingSession`, `readingProgress` (which stories have been
read, so the next round picks a fresh one). `SessionRecord`, `ProblemRecord`, `Operation`,
`SetupKind` and `LESSONS` are **not** modified. No migration.

### Screens

- `src/routes/Reading.tsx` — level picker, showing stories read / stories available per level.
- `src/routes/ReadingPractice.tsx` — the story page: full text, highlighted current sentence,
  `Dalje` / `Ponovi`, then the question step.
- `src/components/reading/` — `StoryPage`, `SentenceLine`, `QuestionPad`, `SyllableCard` (level 1),
  `WordWarmup` (levels 2–3).
- `Home.tsx` — a "Čitanje" card alongside the grade cards.

## Content — supply is the hard constraint

The app is for **daily** use. At one story a day, a school year is ~180 stories; a hand-written
library of 30 is spent in six weeks. Three mechanisms cover the gap, in descending order of leverage.

### 1. Repeated reading doubles the library and is the best drill anyway

Re-reading the same text is the single most effective fluency intervention there is: the second and
third passes are where speed actually moves, because decoding is already done and attention shifts to
phrasing. A story is therefore not consumed on first read — it is read cold, then re-read for a
personal-best WPM. Effective content per story roughly doubles, and the WPM trend finally means
something because it compares like with like.

This makes it a **feature, not a fallback**: the app should offer "pobij svoj rekord" on a story
already read, and show the previous best.

### 2. Levels 2–3 are generated, not written

Level 2–3 texts are short, formulaic and vocabulary-constrained by design — *Maca ima loptu. Lopta je
tu.* Hand-writing hundreds of those is wasted effort, and the app already has the machinery for this
in `wordTemplates.ts`: templates over a controlled noun pool, with `wordDeclension.ts` supplying
correct Croatian forms.

A `storyTemplates.ts` follows the same pattern — a slot-filled 5–8 sentence frame (character, object,
place, small event, resolution) over the level-2/3 vocabulary — giving effectively unlimited material
at exactly the levels that need the most repetition. The decodability guard validates generated text
the same way it validates written text, so quality is enforced mechanically.

Generated stories are thin on plot. That is acceptable at levels 2–3, where the win is fluent
blending, and unacceptable from level 4 up.

### 3. Levels 4–6 are written, with plots adapted from the public domain

Plot is the scarce ingredient, not sentences. Inventing 100 original story arcs is slow; rewriting an
existing one to level is fast. **Aesop is ~350 fables, all public domain, all short with a clean arc**
— two are already adapted in batch 1 (`Mrav i zrno`, `Vjetar i sunce`). Croatian *narodne priče* and
*basne* add more. Grimm and Andersen are public domain and give longer material for level 6.

Croatian children's literature proper does *not* help: Brlić-Mažuranić (PD since 2009) and Nazor
(PD since 2020) are archaic and syntactically dense — the opposite of what a slow decoder needs — and
Grigor Vitez, who would be ideal, is in copyright until 2037.

Word frequency data has one narrow use: ranking candidate vocabulary while writing, so stories lean
on words a kid has met. The [Wiktionary Croatian frequency list](https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/Croatian_wordlist)
(CC BY-SA 4.0) is adequate; the [Croatian Psycholinguistic Database](https://doi.org/10.17234/megahr.2019.hpb)
age-of-acquisition ratings would be better, but its [GitHub mirror](https://github.com/megahr/lexicon)
states no license, so it can inform authoring while nothing from it ships.

### Targets

| Level | Target written | Written | Generated | Effective (with re-reads) |
|---|---|---|---|---|
| 2–3 | ~20 seed stories | **20** ✓ | unlimited | unlimited |
| 4 | 40 | **40** ✓ | — | 80 |
| 5 | 40 | **40** ✓ | — | 80 |
| 6 | 40 | **40** ✓ | — | 80 |

**The written library is complete: 140 stories across batches 1–8.** Every level is at target.
Levels 2–3 remain thin by nature — under their constraints Croatian offers only ~40 usable nouns and
~30 usable verbs, leaving no room for plot — which is exactly why those two levels are handed to
`storyTemplates.ts`; the 20 seed stories exist to prime the generator's vocabulary and fix the
format, not to carry a kid for a month.

Twelve stories are public-domain fable and folk adaptations (Aesop: `Mrav i zrno`, `Vjetar i sunce`,
`Lisica i gavran`, `Lav i miš`, `Pastir i vuk`, `Dvije koze na mostu`, `Lisica i roda`,
`Magarac i sol`, `Gavran i vrč`, `Miš iz grada i miš sa sela`, `Pastirica i vrč mlijeka`,
`Lisica i grožđe`; folk: `Kamena juha`, `Ribar i zlatna ribica`). The rest are original.

**Nothing here has had a native review.** That is now the one blocking item before content ships.

At one story a day with a re-read for speed, 74 stories is already roughly a school year of daily
material for a kid sitting at one or two levels — the remaining batches widen the choice at each
level rather than extend the runway.

### Daily use

A **Priča dana** card on Home: one story at the kid's current level, with the streak mechanics the
app already has for math rounds. The story of the day is chosen from unread stories at that level,
falling back to a re-read (for record-beating) when the level is exhausted — which is also the signal
to promote the kid a level.

Native review is required before anything ships — the drafts are grammatical, but register drifts
adult in places (`posvuda`, `konačno`).

## Batches

| # | Batch | Contents |
|---|---|---|
| 0 | Foundation | `syllabify.ts`, `readingLevels.ts`, the decodability guard, storage keys |
| 1 | Story engine | `readingStories.ts` + batch-1 content, `StoryPage`, `useReadingRound`, `Reading.tsx`, Home card |
| 2 | Questions & stats | `QuestionPad`, `readingStats.ts`, WPM on the summary screen |
| 3 | Repeated reading | Personal-best WPM per story, "pobij svoj rekord" re-read flow |
| 4 | Priča dana | Daily story card on Home, reading streak, level promotion when a level is exhausted |
| 5 | Story generator | `storyTemplates.ts` for levels 2–3 over the controlled vocabulary |
| 6 | Warm-ups | Level 1 syllable cards, level 2–3 word warm-up derived from story vocabulary |
| 7+ | Content fill | ~20 stories per batch, roughly a batch per level, to reach the targets above |
| — | History | Reading session list, WPM trend across sessions |

## Open questions

- Who taps `Dalje` — the kid, or a parent following along? Changes button size and placement.
- Illustrations: one emoji or a simple SVG per story as a header image, or plain text?
- Level promotion: automatic when a level is exhausted and WPM has plateaued, or a parent decision
  in Settings? Automatic risks pushing a kid up too early on a good week.
