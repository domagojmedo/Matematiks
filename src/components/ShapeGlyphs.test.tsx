import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShapeGlyph } from "./ShapeGlyphs";

describe("ShapeGlyph", () => {
  it("renders the requested glyph with an accessible label", () => {
    const { getByTestId, getByLabelText } = render(
      <ShapeGlyph kind="triangle" />,
    );
    expect(getByTestId("shape-glyph").getAttribute("data-glyph")).toBe(
      "triangle",
    );
    expect(getByLabelText("triangle")).toBeTruthy();
  });
});
