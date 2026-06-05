import { expect, test } from "@playwright/test";

// Tier 4: the fraction lesson renders a FractionVisual; the kid types the
// numerator (= shaded segments) and confirms. Read data-shaded to answer
// deterministically despite random generation.

test("fraction lesson renders the visual and accepts the numerator", async ({
  page,
}) => {
  await page.goto("/grade/4");
  await page
    .getByRole("button", { name: /Razlomci/ })
    .first()
    .click();
  await expect(page).toHaveURL(/g4-fractions/);

  const visual = page.getByTestId("fraction-visual");
  await expect(visual).toBeVisible();
  const shaded = await visual.getAttribute("data-shaded");
  expect(shaded).toBeTruthy();

  // Type the numerator (single digit, shaded < parts ≤ 8) and confirm.
  for (const ch of shaded ?? "") {
    await page.getByRole("button", { name: ch, exact: true }).click();
  }
  await page.getByRole("button", { name: "Confirm" }).click();

  await expect(page.getByText(/Zadatak 2 od 20/)).toBeVisible();
});
