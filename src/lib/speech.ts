import type { Language } from "./types";

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
}

export function speechLangTag(language: Language): string {
  return language === "hr" ? "hr-HR" : "en-US";
}

const HR_WORDS: Record<string, number> = {
  nula: 0,
  jedan: 1,
  jedna: 1,
  jedno: 1,
  dva: 2,
  dvije: 2,
  tri: 3,
  cetiri: 4,
  pet: 5,
  sest: 6,
  sedam: 7,
  osam: 8,
  devet: 9,
  deset: 10,
  jedanaest: 11,
  dvanaest: 12,
  trinaest: 13,
  cetrnaest: 14,
  petnaest: 15,
  sesnaest: 16,
  sedamnaest: 17,
  osamnaest: 18,
  devetnaest: 19,
  dvadeset: 20,
  trideset: 30,
  cetrdeset: 40,
  pedeset: 50,
  sezdeset: 60,
  sedamdeset: 70,
  osamdeset: 80,
  devedeset: 90,
  sto: 100,
  stotina: 100,
  dvjesto: 200,
  dvjesta: 200,
  tristo: 300,
  trista: 300,
  cetiristo: 400,
  petsto: 500,
  seststo: 600,
  sedamsto: 700,
  osamsto: 800,
  devetsto: 900,
  tisucu: 1000,
  tisuca: 1000,
  tisuce: 1000,
};

const EN_WORDS: Record<string, number> = {
  zero: 0,
  oh: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fourty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  thousand: 1000,
};

const HUNDRED_MULTIPLIER = new Set(["hundred"]);
const THOUSAND_MULTIPLIER = new Set(["thousand", "tisucu", "tisuca", "tisuce"]);

const HR_FILLER = new Set(["i", "pa"]);
const EN_FILLER = new Set(["and", "a"]);

const COMBINING_MARKS = /[̀-ͯ]/g;

function normalize(token: string): string {
  return token
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Parses a spoken number transcript into a JS number.
 *
 * Returns null when the transcript can't be confidently parsed — caller should
 * treat that as "didn't understand" rather than submitting a wrong answer.
 *
 * Handles: digit strings ("23", "1 2 3"), Croatian/English number words, and
 * compound forms ("twenty three", "dvjesto trideset", "one hundred fifty").
 */
export function parseSpokenNumber(
  transcript: string,
  language: Language,
): number | null {
  if (!transcript) return null;
  const raw = transcript.trim();
  if (!raw) return null;

  const digitsOnly = raw.replace(/[\s,.-]/g, "");
  if (/^\d{1,5}$/.test(digitsOnly)) {
    const n = Number.parseInt(digitsOnly, 10);
    return Number.isFinite(n) ? n : null;
  }

  const wordMap = language === "hr" ? HR_WORDS : EN_WORDS;
  const filler = language === "hr" ? HR_FILLER : EN_FILLER;

  const tokens = raw.split(/\s+/).map(normalize).filter(Boolean);
  if (tokens.length === 0) return null;

  let total = 0;
  let current = 0;
  let matchedAny = false;

  for (const tok of tokens) {
    if (filler.has(tok)) continue;
    if (/^\d+$/.test(tok)) {
      current = current * 10 + Number.parseInt(tok, 10);
      matchedAny = true;
      continue;
    }
    const v = wordMap[tok];
    if (v === undefined) return null;
    matchedAny = true;
    if (HUNDRED_MULTIPLIER.has(tok)) {
      current = (current || 1) * 100;
    } else if (THOUSAND_MULTIPLIER.has(tok)) {
      total += (current || 1) * 1000;
      current = 0;
    } else {
      current += v;
    }
  }

  if (!matchedAny) return null;
  return total + current;
}
