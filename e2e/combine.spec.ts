import { expect, test } from "@playwright/test";

// Grade 3 (HR is the default language) surfaces the new Tier-1 conversion
// lessons and the "Kombiniraj" multi-select. These E2E tests exercise the
// real app — generation is random, so we assert structure, not exact numbers.

test("grade 3 lists the new conversion lessons", async ({ page }) => {
  await page.goto("/grade/3");
  await expect(
    page.getByRole("button", { name: /Mjerne jedinice — duljina/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Mjerne jedinice — vrijeme/ }),
  ).toBeVisible();
});

test("combine mode plays a mixed round from several selected lessons", async ({
  page,
}) => {
  await page.goto("/grade/3");

  // Enter combine mode and pick two distinct word lessons.
  await page.getByRole("button", { name: "Kombiniraj" }).click();
  await page.getByRole("button", { name: /Mjerne jedinice — duljina/ }).click();
  await page.getByRole("button", { name: /Mjerne jedinice — vrijeme/ }).click();

  await expect(page.getByText("Odabrano: 2")).toBeVisible();

  const start = page.getByRole("button", { name: "Pokreni zajedno" });
  await expect(start).toBeEnabled();
  await start.click();

  // Combined round launches with the synthetic title and a real problem.
  await expect(page).toHaveURL(/word-practice\/combined/);
  await expect(page.getByText("Kombinirano vježbanje")).toBeVisible();
  await expect(page.getByText(/Pretvori/)).toBeVisible();
});

test("start is disabled until at least two lessons are selected", async ({
  page,
}) => {
  await page.goto("/grade/3");
  await page.getByRole("button", { name: "Kombiniraj" }).click();
  await page.getByRole("button", { name: /Mjerne jedinice — duljina/ }).click();
  // Only one selected → start stays disabled.
  await expect(page.getByText("Odabrano: 1")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pokreni zajedno" }),
  ).toBeDisabled();
});
