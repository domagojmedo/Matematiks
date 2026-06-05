import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { THEMES } from "../lib/themes";
import { FractionVisual } from "./FractionVisual";

const theme = THEMES.warmPurple;

describe("FractionVisual", () => {
  it("renders one segment per part and exposes parts/shaded", () => {
    const { getByTestId } = render(
      <FractionVisual parts={4} shaded={3} theme={theme} />,
    );
    const visual = getByTestId("fraction-visual");
    expect(visual.getAttribute("data-parts")).toBe("4");
    expect(visual.getAttribute("data-shaded")).toBe("3");
    expect(visual.children).toHaveLength(4);
  });

  it("has an accessible label describing the shaded portion", () => {
    const { getByLabelText } = render(
      <FractionVisual parts={3} shaded={1} theme={theme} />,
    );
    expect(getByLabelText("1 od 3 dijelova obojano")).toBeTruthy();
  });
});
