import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShapeDiagram } from "./ShapeDiagram";

describe("ShapeDiagram", () => {
  it("exposes width/height and labels both sides in cm", () => {
    const { getByTestId, getAllByText } = render(
      <ShapeDiagram width={5} height={3} />,
    );
    const box = getByTestId("shape-diagram");
    expect(box.getAttribute("data-width")).toBe("5");
    expect(box.getAttribute("data-height")).toBe("3");
    expect(getAllByText("5 cm").length).toBeGreaterThan(0);
    expect(getAllByText("3 cm").length).toBeGreaterThan(0);
  });
});
