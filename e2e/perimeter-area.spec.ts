import { expect, test } from "@playwright/test";

// Tier 5: perimeter lessons draw a ShapeDiagram and accept the numeric answer.
// Read the rectangle's width/height to compute the expected perimeter.

test("perimeter lesson renders a diagram and accepts the answer", async ({
  page,
}) => {
  await page.goto("/grade/3");
  await page
    .getByRole("button", { name: /Opseg pravokutnika/ })
    .first()
    .click();
  await expect(page).toHaveURL(/g3-perimeter/);

  const diagram = page.getByTestId("shape-diagram");
  await expect(diagram).toBeVisible();
  const w = Number(await diagram.getAttribute("data-width"));
  const h = Number(await diagram.getAttribute("data-height"));
  const perimeter = String(2 * (w + h));

  for (const ch of perimeter) {
    await page.getByRole("button", { name: ch, exact: true }).click();
  }
  await page.getByRole("button", { name: "Confirm" }).click();

  await expect(page.getByText(/Zadatak 2 od 20/)).toBeVisible();
});
