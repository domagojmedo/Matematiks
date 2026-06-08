import { expect, test } from "@playwright/test";

// Regression guard for the shared-chrome refactor: a written-column
// arithmetic lesson still mounts and renders its frame + numpad. (The column
// body itself is covered by unit tests on columnPhases.)

test("written-column lesson renders through the shared frame", async ({
  page,
}) => {
  await page.goto("/grade/3");
  await page
    .getByRole("button", { name: /Pisano zbrajanje do 1000/ })
    .first()
    .click();
  await expect(page).toHaveURL(/practice\/add/);
  // Chrome from RoundFrame/QuestionScaffold.
  await expect(page.getByText(/Zadatak 1 od 20/)).toBeVisible();
  // Numpad from the column screen.
  await expect(
    page.getByRole("button", { name: "7", exact: true }),
  ).toBeVisible();
});
