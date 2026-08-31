/**
 * Regression test for entering a custom problem count on the setup screen.
 *
 * The bug had two halves: clearing the field committed 0 (see
 * `NumberField.test.tsx`), and the custom field's visibility was derived from
 * the value — so typing "100" hit the intermediate 10, which is a preset, and
 * the field unmounted after the second keystroke.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProfilesProvider } from "../contexts/ProfilesContext";
import { SettingsProvider } from "../contexts/SettingsContext";
import "../i18n";
import { PROFILE_KEYS, profileKey, readJSON } from "../lib/storage";
import type { OperationSetup } from "../lib/types";
import { Setup } from "./Setup";

const MIN_LABEL = "Najmanje";
const MAX_LABEL = "Najviše";
const CUSTOM_LABEL = "Prilagođeno";
const START_LABEL = "Pokreni vježbu";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

function renderSetup(op = "add") {
  return render(
    <MemoryRouter initialEntries={[`/setup/${op}`]}>
      <SettingsProvider>
        <ProfilesProvider>
          <Routes>
            <Route path="/setup/:operation" element={<Setup />} />
          </Routes>
        </ProfilesProvider>
      </SettingsProvider>
    </MemoryRouter>,
  );
}

/** The custom-count input, once the "Prilagođeno" length button is on. */
function countField() {
  return screen.getByRole("spinbutton", {
    name: "Broj zadataka",
  }) as HTMLInputElement;
}

function openCustomCount() {
  // The length section's custom button (the range section has one too).
  const buttons = screen.getAllByRole("button", { name: CUSTOM_LABEL });
  fireEvent.click(buttons[buttons.length - 1]);
}

/** The custom range fields, once the range custom chip is on. */
function rangeField(name: typeof MIN_LABEL | typeof MAX_LABEL) {
  return screen.getByRole("spinbutton", { name }) as HTMLInputElement;
}

function openCustomRange() {
  // The range section's custom chip is the first of the two on the screen.
  const chips = screen.getAllByRole("button", { name: CUSTOM_LABEL });
  fireEvent.click(chips[0]);
}

function startButton() {
  return screen.getByRole("button", {
    name: START_LABEL,
  }) as HTMLButtonElement;
}

describe("Setup — custom range", () => {
  it("lets min be raised above the current max without snapping back", () => {
    renderSetup();
    openCustomRange();
    // Preset small is 1..20; going to 30..100 means min briefly exceeds max.
    fireEvent.change(rangeField(MIN_LABEL), { target: { value: "30" } });
    fireEvent.blur(rangeField(MIN_LABEL));
    expect(rangeField(MIN_LABEL).value).toBe("30");

    fireEvent.change(rangeField(MAX_LABEL), { target: { value: "100" } });
    fireEvent.blur(rangeField(MAX_LABEL));
    expect(rangeField(MIN_LABEL).value).toBe("30");
    expect(rangeField(MAX_LABEL).value).toBe("100");
  });

  it("explains a crossed range and blocks Start until it is fixed", () => {
    renderSetup();
    openCustomRange();
    fireEvent.change(rangeField(MIN_LABEL), { target: { value: "30" } });
    fireEvent.blur(rangeField(MIN_LABEL));

    // min(30) >= max(20): message shown, Start disabled.
    expect(screen.getByRole("alert")).toBeDefined();
    expect(startButton().disabled).toBe(true);

    fireEvent.change(rangeField(MAX_LABEL), { target: { value: "100" } });
    fireEvent.blur(rangeField(MAX_LABEL));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(startButton().disabled).toBe(false);
  });
});

describe("Setup — custom problem count", () => {
  it("keeps the field open while typing 100 and starts enabled", () => {
    renderSetup();
    openCustomCount();

    fireEvent.change(countField(), { target: { value: "" } });
    expect(countField().value).toBe("");

    // 10 is a preset — the field used to unmount right here.
    fireEvent.change(countField(), { target: { value: "1" } });
    fireEvent.change(countField(), { target: { value: "10" } });
    expect(countField()).toBeDefined();

    fireEvent.change(countField(), { target: { value: "100" } });
    fireEvent.blur(countField());

    expect(countField().value).toBe("100");
    expect(
      (
        screen.getByRole("button", {
          name: "Pokreni vježbu",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("persists the custom count to the profile's saved setup", () => {
    renderSetup();
    openCustomCount();
    fireEvent.change(countField(), { target: { value: "" } });
    fireEvent.change(countField(), { target: { value: "100" } });
    fireEvent.blur(countField());

    const saved = readJSON<Record<string, OperationSetup>>(
      profileKey(
        JSON.parse(localStorage.getItem("matematiks.activeProfileId") ?? '""'),
        PROFILE_KEYS.setups,
      ),
      {},
    );
    expect(saved.add?.rounds).toBe(100);
  });

  it("clearing the field never persists a zero-length round", () => {
    renderSetup();
    openCustomCount();
    fireEvent.change(countField(), { target: { value: "" } });

    // Start must stay enabled — the last good count is still in effect.
    expect(
      (
        screen.getByRole("button", {
          name: "Pokreni vježbu",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("stays open when the typed count happens to equal a preset", () => {
    renderSetup();
    openCustomCount();
    // 10 is one of the preset buttons; the field used to unmount on this
    // keystroke, making 100 impossible to finish typing.
    fireEvent.change(countField(), { target: { value: "10" } });
    expect(
      screen.queryByRole("spinbutton", { name: "Broj zadataka" }),
    ).not.toBeNull();
  });

  it("picking a preset after typing a custom count closes the field", () => {
    renderSetup();
    openCustomCount();
    fireEvent.change(countField(), { target: { value: "100" } });

    fireEvent.click(screen.getByRole("button", { name: "50" }));
    expect(
      screen.queryByRole("spinbutton", { name: "Broj zadataka" }),
    ).toBeNull();
  });
});
