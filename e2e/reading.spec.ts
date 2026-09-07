import { expect, test } from "@playwright/test";

// The reading module end to end: read a story sentence by sentence, answer the
// comprehension question, land on a words-per-minute summary, and have the run
// show up in history. Uses "Maca i lopta" (level 2, five sentences, one
// question) so the walk is deterministic.

const STORY = "/reading/story/maca-i-lopta";

/**
 * Read the five sentences at a believable pace.
 *
 * The story is 15 words, so anything under ~3s total scores above the
 * plausible-reading ceiling and is deliberately discarded as a non-measurement.
 * Clicking straight through — which is what these tests did originally — would
 * exercise only that rejection path.
 */
async function readAtHumanPace(page: import("@playwright/test").Page) {
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: "Dalje" }).click();
  }
}

test("reads a story through to a words-per-minute summary", async ({
  page,
}) => {
  await page.goto(STORY);

  await expect(
    page.getByRole("heading", { name: "Maca i lopta" }),
  ).toBeVisible();
  // The whole story is on the page from the start, not one sentence at a time.
  await expect(page.getByText("Maca je mala.")).toBeVisible();
  await expect(page.getByText("Maca ide mami.")).toBeVisible();

  await readAtHumanPace(page);

  // Comprehension question, then the summary.
  await expect(
    page.getByRole("heading", { name: /Tko ima loptu/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "maca", exact: true }).click();

  await expect(page.getByText("Pročitano!")).toBeVisible();
  await expect(page.getByText("rij/min")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pobij svoj rekord" }),
  ).toBeVisible();
});

test("records the run in history and marks a re-read", async ({ page }) => {
  await page.goto(STORY);
  await readAtHumanPace(page);
  await page.getByRole("button", { name: "maca", exact: true }).click();
  await expect(page.getByText("Pročitano!")).toBeVisible();

  await page.goto("/reading/history");
  await expect(page.getByText("Maca i lopta").first()).toBeVisible();

  // A second run of the same story is flagged as a re-read.
  await page.goto(STORY);
  await expect(page.getByText(/ponovno čitanje/)).toBeVisible();
});

test("a stumble does not skip the sentence", async ({ page }) => {
  await page.goto(STORY);
  const first = page.getByText("Maca je mala.");
  await expect(first).toHaveAttribute("data-current", "true");

  await page.getByRole("button", { name: "Ponovi" }).click();
  // Still on the same line — Ponovi marks a stumble, it does not advance.
  await expect(first).toHaveAttribute("data-current", "true");

  await page.getByRole("button", { name: "Dalje" }).click();
  await expect(page.getByText("Maca ima loptu.")).toHaveAttribute(
    "data-current",
    "true",
  );
});

test("leaving mid-story records nothing", async ({ page }) => {
  await page.goto(STORY);
  await page.getByRole("button", { name: "Dalje" }).click();
  await page.getByRole("button", { name: "Natrag" }).click();
  await page.getByRole("button", { name: "Izađi" }).click();

  await page.goto("/reading/history");
  // Words per minute over part of a story is a different measurement, so an
  // abandoned read must leave the trend untouched.
  await expect(page.getByText("Još nema pročitanih priča.")).toBeVisible();
});

test("switches between mala and velika tiskana slova", async ({ page }) => {
  await page.goto("/reading");
  await page.getByRole("button", { name: "VELIKA SLOVA" }).click();

  await page.goto(STORY);
  const sentence = page.getByText("Maca je mala.");
  // CSS does the transform, so the DOM text is unchanged and only the style
  // differs — which is what keeps screen readers and copy correct.
  await expect(sentence).toHaveCSS("text-transform", "uppercase");
});

test("a story tapped straight through is not recorded", async ({ page }) => {
  await page.goto(STORY);
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: "Dalje" }).click();
  }
  await page.getByRole("button", { name: "maca", exact: true }).click();

  await expect(page.getByText("Pročitano!")).toBeVisible();
  await expect(page.getByText(/Prebrzo za mjerenje/)).toBeVisible();

  // Nothing reaches history, so one fast tap-through cannot plant an
  // unbeatable record or flatten the trend chart.
  await page.goto("/reading/history");
  await expect(page.getByText("Još nema pročitanih priča.")).toBeVisible();
});

test("can be read start to finish with the keyboard alone", async ({
  page,
}) => {
  await page.goto(STORY);

  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(800);
    await page.keyboard.press("Space");
  }

  await expect(
    page.getByRole("heading", { name: /Tko ima loptu/ }),
  ).toBeVisible();
  // Nothing is focused until an arrow is pressed, so a stray Space on arrival
  // cannot answer the question.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  await expect(page.getByText("Pročitano!")).toBeVisible();
});

test("left arrow re-reads the line instead of advancing", async ({ page }) => {
  await page.goto(STORY);
  const first = page.getByText("Maca je mala.");
  await expect(first).toHaveAttribute("data-current", "true");

  await page.keyboard.press("ArrowLeft");
  await expect(first).toHaveAttribute("data-current", "true");

  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Maca ima loptu.")).toHaveAttribute(
    "data-current",
    "true",
  );
});

test("space activates the focused button, not the advance key", async ({
  page,
}) => {
  await page.goto(STORY);
  const first = page.getByText("Maca je mala.");

  // Clicking Ponovi leaves it focused. Space must then re-read that line --
  // the key handler has to stand down for a focused control, or it would
  // advance instead and swallow the button's own activation.
  await page.getByRole("button", { name: "Ponovi" }).click();
  await expect(first).toHaveAttribute("data-current", "true");

  await page.keyboard.press("Space");
  await expect(first).toHaveAttribute("data-current", "true");
});

test("warm-up cards advance with the keyboard", async ({ page }) => {
  await page.goto("/reading/warmup");
  await expect(page.getByText("1/20")).toBeVisible();

  await page.keyboard.press("Space");
  await expect(page.getByText("2/20")).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("3/20")).toBeVisible();
});

/**
 * The highlight must not move the text.
 *
 * A slow reader tracks lines with their eyes; if advancing the highlight
 * reflows the paragraph and shunts words onto different lines, they lose their
 * place entirely. Every sentence therefore carries the same box and only the
 * colours change, and this measures that directly rather than trusting it.
 *
 * Positions are document-relative and fonts are awaited first: viewport
 * coordinates would also catch Playwright scrolling the button into view, and
 * a late webfont reflows everything once on its own.
 */
test("text does not shift as the highlight advances", async ({ page }) => {
  // A level-6 story: three paragraphs, plenty of wrapping.
  await page.goto("/reading/story/prvi-bicikl");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  const boxes = () =>
    page.$$eval("[data-sentence]", (nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return [
          Math.round(rect.x + window.scrollX),
          Math.round(rect.y + window.scrollY),
          Math.round(rect.width),
        ].join(",");
      }),
    );

  const before = await boxes();
  expect(before.length).toBeGreaterThan(10);

  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "Dalje" }).click();
    await page.waitForTimeout(250);
    expect(await boxes(), `after ${i + 1} advance(s)`).toEqual(before);
  }
});

test("returning from a story keeps the level you were browsing", async ({
  page,
}) => {
  await page.goto("/reading");
  await page.getByRole("button", { name: "4. razina" }).click();
  await expect(page.getByText("Zimsko jutro")).toBeVisible();

  await page.getByText("Zimsko jutro").click();
  await expect(
    page.getByRole("heading", { name: "Zimsko jutro" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Natrag" }).click();
  await page.getByRole("button", { name: "Izađi" }).click();

  // Level 4 must still be selected, not the child's own level.
  await expect(page.getByText("Zimsko jutro")).toBeVisible();
  await expect(page.getByRole("button", { name: "4. razina" })).toHaveAttribute(
    "class",
    /text-white/,
  );
});

test("level 1 is offered and leads to syllable practice", async ({ page }) => {
  await page.goto("/reading");
  await page.getByRole("button", { name: "1. razina" }).click();
  await expect(page.getByText("Slogovi")).toBeVisible();

  await page.getByText("Slogovi").click();
  await expect(page.getByText("1/20")).toBeVisible();
});

test("next story keeps you reading without going back to the list", async ({
  page,
}) => {
  await page.goto(STORY);
  await readAtHumanPace(page);
  await page.getByRole("button", { name: "maca", exact: true }).click();
  await expect(page.getByText("Pročitano!")).toBeVisible();

  await page.getByRole("button", { name: /Sljedeća priča/ }).click();

  // Straight into another story at the same level, not the picker.
  await expect(page).toHaveURL(/\/reading\/story\//);
  await expect(page).not.toHaveURL(/maca-i-lopta/);
  await expect(page.getByRole("button", { name: "Dalje" })).toBeVisible();
  await expect(page.getByText("2. razina")).toBeVisible();
});
