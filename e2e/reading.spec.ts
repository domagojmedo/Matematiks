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
