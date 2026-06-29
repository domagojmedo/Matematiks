import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { THEMES } from "../lib/themes";
import { MiniBarChart } from "./MiniBarChart";

// Each test renders the chart; without cleanup the renders accumulate in the
// document and the shared test-id / scale labels match multiple elements.
afterEach(cleanup);

const bars = (root: HTMLElement) => [
  ...root.querySelectorAll<HTMLElement>("[style*='height']"),
];

describe("MiniBarChart", () => {
  it("renders a bar + label per value and exposes the series", () => {
    const { getByTestId, getByText } = render(
      <MiniBarChart
        labels={["a", "b", "c"]}
        values={[2, 5, 1]}
        theme={THEMES.teal}
      />,
    );
    expect(getByTestId("mini-bar-chart").getAttribute("data-values")).toBe(
      "2,5,1",
    );
    for (const l of ["a", "b", "c"]) expect(getByText(l)).toBeTruthy();
  });

  it("scales bar heights proportionally to the tallest value", () => {
    // Regression: bars used to collapse to a flat line because the column had
    // no definite height for the percentage height to resolve against.
    const { getByTestId } = render(
      <MiniBarChart
        labels={["a", "b", "c"]}
        values={[2, 5, 1]}
        theme={THEMES.teal}
      />,
    );
    // top = 6 (one step above the tallest bar) → heights 33% / 83% / 17%.
    // The tallest bar is 83%, not 100%, so it isn't pinned to the ceiling.
    expect(
      bars(getByTestId("mini-bar-chart")).map((b) => b.style.height),
    ).toEqual(["33%", "83%", "17%"]);
  });

  it("prints no value on the bars — the kid reads them off the scale", () => {
    // Regression: the value was printed above each bar, giving away the answer
    // and making the chart pointless. The bars must carry no text; the y-axis
    // scale is the only place numbers appear.
    const { getByTestId } = render(
      <MiniBarChart
        labels={["a", "b", "c"]}
        values={[2, 5, 1]}
        theme={THEMES.teal}
      />,
    );
    for (const bar of bars(getByTestId("mini-bar-chart"))) {
      expect(bar.textContent).toBe("");
    }
  });

  it("renders a y-axis scale with headroom above the tallest value", () => {
    const { getByText } = render(
      <MiniBarChart
        labels={["a", "b", "c"]}
        values={[2, 5, 1]}
        theme={THEMES.teal}
      />,
    );
    // Tallest is 5, so the scale runs 0..6 — a labelled tick (6) sits above it.
    for (const t of ["0", "1", "2", "3", "4", "5", "6"]) {
      expect(getByText(t)).toBeTruthy();
    }
  });

  it("widens the tick step so a large series doesn't render one line per unit", () => {
    // Out-of-spec values (the lesson uses 1–10) must not explode the axis into
    // 100+ labels/gridlines; the step widens to keep it legible.
    const { getByTestId, getByText, queryByText } = render(
      <MiniBarChart
        labels={["a", "b", "c"]}
        values={[40, 100, 20]}
        theme={THEMES.teal}
      />,
    );
    // The axis stays legible (≤ ~10 ticks), starts at 0, and skips unit ticks.
    expect(getByTestId("chart-yaxis").children.length).toBeLessThanOrEqual(10);
    expect(getByText("0")).toBeTruthy();
    expect(queryByText("99")).toBeNull();
  });
});
