import { expect, test } from "@playwright/test";

// Tier 6: shape recognition draws a glyph and offers name options (choice pad).
// Read data-glyph, tap the matching Croatian name, expect the round to advance.

const NAME: Record<string, string> = {
  circle: "krug",
  square: "kvadrat",
  rectangle: "pravokutnik",
  triangle: "trokut",
};

test("shape recognition: tapping the correct name advances", async ({
  page,
}) => {
  await page.goto("/grade/1");
  await page
    .getByRole("button", { name: /Prepoznaj geometrijske likove/ })
    .first()
    .click();
  await expect(page).toHaveURL(/g1-shapes/);

  const glyph = page.getByTestId("shape-glyph");
  await expect(glyph).toBeVisible();
  const kind = await glyph.getAttribute("data-glyph");
  const name = NAME[kind ?? ""];
  expect(name).toBeTruthy();

  await page.getByRole("button", { name, exact: true }).click();
  await expect(page.getByText(/Zadatak 2 od 20/)).toBeVisible();
});
