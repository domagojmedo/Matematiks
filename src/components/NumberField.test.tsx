/**
 * Regression tests for the setup number inputs.
 *
 * The bug: the field was bound straight to a number, so clearing it produced
 * `Number("") === 0` and the box snapped to "0" — you could never clear it and
 * type a fresh value like 100.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { NumberField } from "./NumberField";

// Without cleanup the renders accumulate and the field query matches many.
afterEach(cleanup);

/** Mirrors how Setup drives the field: controlled, value fed back in. */
function Harness({
  initial = 20,
  min = 1,
  max = 999,
  onValue,
}: {
  initial?: number;
  min?: number;
  max?: number;
  onValue?: (n: number) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <NumberField
      label="Rounds"
      value={value}
      min={min}
      max={max}
      onChange={(n) => {
        setValue(n);
        onValue?.(n);
      }}
      focus=""
    />
  );
}

function field() {
  return screen.getByRole("spinbutton", { name: "Rounds" }) as HTMLInputElement;
}

describe("NumberField", () => {
  it("stays empty when cleared instead of snapping to 0", () => {
    render(<Harness initial={20} />);
    fireEvent.change(field(), { target: { value: "" } });
    expect(field().value).toBe("");
  });

  it("accepts a fresh multi-digit value typed after clearing", () => {
    const seen: number[] = [];
    render(<Harness initial={20} onValue={(n) => seen.push(n)} />);

    fireEvent.change(field(), { target: { value: "" } });
    for (const step of ["1", "10", "100"]) {
      fireEvent.change(field(), { target: { value: step } });
    }
    fireEvent.blur(field());

    expect(field().value).toBe("100");
    expect(seen.at(-1)).toBe(100);
    // Clearing must never have committed 0 upstream.
    expect(seen).not.toContain(0);
  });

  it("reverts to the last good value when left empty on blur", () => {
    render(<Harness initial={20} />);
    fireEvent.change(field(), { target: { value: "" } });
    fireEvent.blur(field());
    expect(field().value).toBe("20");
  });

  it("clamps an out-of-range entry on blur", () => {
    render(<Harness initial={20} min={1} max={999} />);
    fireEvent.change(field(), { target: { value: "5000" } });
    fireEvent.blur(field());
    expect(field().value).toBe("999");
  });

  it("clamps a below-minimum entry on blur", () => {
    render(<Harness initial={20} min={10} max={999} />);
    fireEvent.change(field(), { target: { value: "3" } });
    fireEvent.blur(field());
    expect(field().value).toBe("10");
  });

  it("does not push out-of-range values upstream while typing", () => {
    const seen: number[] = [];
    render(
      <Harness initial={20} min={10} max={999} onValue={(n) => seen.push(n)} />,
    );
    fireEvent.change(field(), { target: { value: "" } });
    fireEvent.change(field(), { target: { value: "5" } });
    expect(seen).toHaveLength(0);
    expect(field().value).toBe("5");
  });
});
