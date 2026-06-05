import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { THEMES } from "../lib/themes";
import { MiniBarChart } from "./MiniBarChart";

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
});
