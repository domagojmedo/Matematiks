import { expect, test } from "@playwright/test";

// Tier 3 introduces the `compare` phase + its </=/> pad. Generation is random,
// so we read the two operands from the equation row and click the correct
// relation, then assert the score advances — exercising the new pad end-to-end.

test("comparison lesson: correct relation scores and advances", async ({
  page,
}) => {
  await page.goto("/grade/1");
  await page
    .getByRole("button", { name: /Usporedi brojeve/ })
    .first()
    .click();
  await expect(page).toHaveURL(/g1-compare/);
  await expect(page.getByText(/Upiši <, = ili >/)).toBeVisible();

  // The </=/> pad is present.
  for (const rel of ["<", "=", ">"]) {
    await expect(
      page.getByRole("button", { name: rel, exact: true }),
    ).toBeVisible();
  }

  // Read the equation row "a ? b" (the row whose middle cell is the unknown).
  const ops = await page.evaluate(() => {
    const rows = [
      ...document.querySelectorAll("div.items-baseline.tabular-nums"),
    ];
    const row = rows.find((r) =>
      [...r.querySelectorAll("span")].some(
        (s) => s.textContent?.trim() === "?",
      ),
    );
    if (!row) return null;
    return [...row.querySelectorAll("span")].map((s) => s.textContent?.trim());
  });
  expect(ops).not.toBeNull();
  const a = Number(ops?.[0]);
  const b = Number(ops?.[2]);
  const rel = a < b ? "<" : a > b ? ">" : "=";

  await page.getByRole("button", { name: rel, exact: true }).click();
  // Correct relation → round advances to the second problem.
  await expect(page.getByText(/Zadatak 2 od 20/)).toBeVisible();
});
