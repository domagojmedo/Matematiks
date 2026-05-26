import { describe, expect, it } from "vitest";
import { parseSpokenNumber } from "./speech";

describe("parseSpokenNumber", () => {
  it("parses digit strings", () => {
    expect(parseSpokenNumber("23", "hr")).toBe(23);
    expect(parseSpokenNumber("23", "en")).toBe(23);
    expect(parseSpokenNumber("1 2 5", "en")).toBe(125);
  });

  it("parses single-word Croatian numbers", () => {
    expect(parseSpokenNumber("nula", "hr")).toBe(0);
    expect(parseSpokenNumber("sedam", "hr")).toBe(7);
    expect(parseSpokenNumber("dvanaest", "hr")).toBe(12);
    expect(parseSpokenNumber("dvadeset", "hr")).toBe(20);
    expect(parseSpokenNumber("sto", "hr")).toBe(100);
  });

  it("handles Croatian diacritics", () => {
    expect(parseSpokenNumber("četiri", "hr")).toBe(4);
    expect(parseSpokenNumber("šest", "hr")).toBe(6);
    expect(parseSpokenNumber("šezdeset", "hr")).toBe(60);
  });

  it("parses Croatian compounds with and without filler", () => {
    expect(parseSpokenNumber("dvadeset tri", "hr")).toBe(23);
    expect(parseSpokenNumber("dvadeset i tri", "hr")).toBe(23);
    expect(parseSpokenNumber("dvjesto trideset", "hr")).toBe(230);
    expect(parseSpokenNumber("petsto pedeset pet", "hr")).toBe(555);
  });

  it("parses Croatian thousands", () => {
    expect(parseSpokenNumber("dvije tisuće", "hr")).toBe(2000);
    expect(parseSpokenNumber("tisuću dvjesto", "hr")).toBe(1200);
  });

  it("parses single-word English numbers", () => {
    expect(parseSpokenNumber("seven", "en")).toBe(7);
    expect(parseSpokenNumber("eleven", "en")).toBe(11);
    expect(parseSpokenNumber("ninety", "en")).toBe(90);
  });

  it("parses English compounds with hundred/thousand", () => {
    expect(parseSpokenNumber("twenty three", "en")).toBe(23);
    expect(parseSpokenNumber("one hundred fifty", "en")).toBe(150);
    expect(parseSpokenNumber("two hundred and thirty", "en")).toBe(230);
    expect(parseSpokenNumber("one thousand two hundred", "en")).toBe(1200);
  });

  it("returns null for unknown tokens", () => {
    expect(parseSpokenNumber("banana", "en")).toBeNull();
    expect(parseSpokenNumber("twenty banana", "en")).toBeNull();
    expect(parseSpokenNumber("", "hr")).toBeNull();
    expect(parseSpokenNumber("   ", "hr")).toBeNull();
  });
});
