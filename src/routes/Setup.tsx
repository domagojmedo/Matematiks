import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useProfiles } from "../contexts/ProfilesContext";
import { useSettings } from "../contexts/SettingsContext";
import {
  isValidOperation,
  OPERATION_SYMBOL,
  OPERATION_TONE,
  TONE_CHIP,
} from "../lib/operations";
import {
  getSetup,
  RANGE_PRESETS,
  ROUND_SIZE_OPTIONS,
  saveSetup,
  TIME_OPTIONS_MS,
} from "../lib/setup";
import { PROFILE_KEYS, profileKey, writeJSON } from "../lib/storage";
import type { Operation, OperationSetup } from "../lib/types";

const MULTIPLICANDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function Setup() {
  const { operation } = useParams<{ operation: string }>();
  const { t } = useTranslation();
  const { theme, settings } = useSettings();
  const { profileId } = useProfiles();
  const navigate = useNavigate();

  const isValidOp = operation !== undefined && isValidOperation(operation);
  const op: Operation = isValidOp ? operation : "add";
  const tone = OPERATION_TONE[op];
  const pageBg = settings.dark ? theme.pageBgDark : theme.pageBg;

  const [setup, setSetup] = useState<OperationSetup>(() =>
    getSetup(profileId, op),
  );

  useEffect(() => {
    if (isValidOp) saveSetup(profileId, op, setup);
  }, [profileId, op, setup, isValidOp]);

  if (!isValidOp) {
    return <Navigate to="/" replace />;
  }

  function start() {
    saveSetup(profileId, op, setup);
    writeJSON(profileKey(profileId, PROFILE_KEYS.lastSession), {
      operation: op,
      setup,
    });
    navigate(`/practice/${op}`);
  }

  return (
    <div className={`min-h-screen w-full ${pageBg}`}>
      <div className="mx-auto max-w-2xl px-5 pt-6 pb-8 md:px-8 md:py-10">
        <header className="mb-6 flex items-center justify-between">
          <Link
            to="/"
            aria-label={t("common.back")}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800"
          >
            <svg
              aria-hidden="true"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="text-stone-700 dark:text-stone-200"
            >
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </Link>
          <div
            className={`flex h-10 items-center gap-1.5 rounded-full bg-white px-3 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800`}
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-base leading-none font-black ring-2 ${TONE_CHIP[tone]}`}
            >
              {OPERATION_SYMBOL[op]}
            </span>
            <span className="text-sm font-black text-stone-900 dark:text-white">
              {t(`operations.${op}`)}
            </span>
          </div>
          <div className="w-12" />
        </header>

        <h1 className="mb-6 text-2xl font-black tracking-tight text-stone-900 md:text-3xl dark:text-white">
          {t("setup.title")}
        </h1>

        {setup.kind === "range" && (
          <RangePicker
            setup={setup}
            onChange={(next) => setSetup(next)}
            theme={theme}
          />
        )}
        {setup.kind === "multiplicands" && (
          <MultiplicandsPicker
            setup={setup}
            onChange={(next) => setSetup(next)}
            theme={theme}
          />
        )}

        <LengthPicker setup={setup} onChange={setSetup} theme={theme} />

        <button
          type="button"
          onClick={start}
          disabled={!isSetupValid(setup)}
          className={`mt-6 h-14 w-full rounded-2xl text-base font-black text-white shadow-sm transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50 ${theme.primary} ${theme.primaryHover} ${theme.primaryShadow} ${theme.primaryFocus}`}
        >
          {t("setup.startRound")}
        </button>
      </div>
    </div>
  );
}

function isSetupValid(s: OperationSetup): boolean {
  const lenValid = s.timeMs !== undefined ? s.timeMs > 0 : s.rounds > 0;
  if (!lenValid) return false;
  if (s.kind === "range") return s.min < s.max;
  return s.values.length > 0;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2.5 text-sm font-black tracking-wider text-stone-500 uppercase dark:text-stone-400">
      {children}
    </h2>
  );
}

function ChipButton({
  active,
  onClick,
  children,
  themeRing,
  themeBg,
  themeText,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  themeRing: string;
  themeBg: string;
  themeText: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-12 items-center justify-center rounded-2xl px-2 text-center text-base font-black ring-2 transition active:scale-[0.98] ${
        active
          ? `${themeBg} ${themeText} ${themeRing}`
          : "bg-white text-stone-700 ring-stone-200 hover:ring-stone-300 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-800 dark:hover:ring-stone-700"
      }`}
    >
      {children}
    </button>
  );
}

function RangePicker({
  setup,
  onChange,
  theme,
}: {
  setup: Extract<OperationSetup, { kind: "range" }>;
  onChange: (s: OperationSetup) => void;
  theme: ReturnType<typeof useSettings>["theme"];
}) {
  const { t } = useTranslation();
  const isPresetMatch = (min: number, max: number) =>
    setup.min === min &&
    setup.max === max &&
    setup.min2 === undefined &&
    setup.max2 === undefined;
  const isCustom = !RANGE_PRESETS.some((p) => isPresetMatch(p.min, p.max));
  const asymmetric = setup.min2 !== undefined || setup.max2 !== undefined;

  const presetBg = "bg-violet-100 dark:bg-violet-900/40";
  const presetText = "text-violet-700 dark:text-violet-200";
  const presetRing = "ring-violet-300 dark:ring-violet-700";

  const setSymmetric = (min: number, max: number) =>
    onChange({ ...setup, min, max, min2: undefined, max2: undefined });

  const toggleAsymmetric = () => {
    if (asymmetric) {
      onChange({ ...setup, min2: undefined, max2: undefined });
    } else {
      onChange({ ...setup, min2: setup.min, max2: setup.max });
    }
  };

  const min2 = setup.min2 ?? setup.min;
  const max2 = setup.max2 ?? setup.max;

  return (
    <section className="mb-6">
      <SectionHeading>{t("setup.range")}</SectionHeading>
      <div className="grid grid-cols-3 gap-2.5">
        {RANGE_PRESETS.map((p) => (
          <ChipButton
            key={p.key}
            active={isPresetMatch(p.min, p.max)}
            onClick={() => setSymmetric(p.min, p.max)}
            themeBg={presetBg}
            themeText={presetText}
            themeRing={presetRing}
          >
            {t(
              `setup.rangePreset${
                p.key.charAt(0).toUpperCase() + p.key.slice(1)
              }`,
            )}
          </ChipButton>
        ))}
        <ChipButton
          active={isCustom}
          onClick={() => setSymmetric(1, 50)}
          themeBg={presetBg}
          themeText={presetText}
          themeRing={presetRing}
        >
          {t("setup.rangePresetCustom")}
        </ChipButton>
      </div>

      {isCustom && (
        <>
          <p className="mt-4 mb-2 px-1 text-xs font-bold tracking-wider text-stone-500 uppercase dark:text-stone-400">
            {asymmetric ? t("setup.rangeFirst") : ""}
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <NumberField
              label={t("setup.min")}
              value={setup.min}
              min={1}
              max={setup.max - 1}
              onChange={(v) => onChange({ ...setup, min: v })}
              focus={theme.primaryFocus}
            />
            <NumberField
              label={t("setup.max")}
              value={setup.max}
              min={setup.min + 1}
              max={9999}
              onChange={(v) => onChange({ ...setup, max: v })}
              focus={theme.primaryFocus}
            />
          </div>

          <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
            <input
              type="checkbox"
              checked={asymmetric}
              onChange={toggleAsymmetric}
              className={`h-5 w-5 rounded ${theme.primaryFocus}`}
            />
            <span className="text-sm font-bold text-stone-700 dark:text-stone-200">
              {t("setup.differentSecondRange")}
            </span>
          </label>

          {asymmetric && (
            <>
              <p className="mt-3 mb-2 px-1 text-xs font-bold tracking-wider text-stone-500 uppercase dark:text-stone-400">
                {t("setup.rangeSecond")}
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <NumberField
                  label={t("setup.min")}
                  value={min2}
                  min={1}
                  max={max2 - 1}
                  onChange={(v) => onChange({ ...setup, min2: v })}
                  focus={theme.primaryFocus}
                />
                <NumberField
                  label={t("setup.max")}
                  value={max2}
                  min={min2 + 1}
                  max={9999}
                  onChange={(v) => onChange({ ...setup, max2: v })}
                  focus={theme.primaryFocus}
                />
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
  focus,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  focus: string;
}) {
  return (
    <label className="block">
      <span className="block px-1 text-xs font-bold tracking-wider text-stone-500 uppercase dark:text-stone-400">
        {label}
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className={`mt-1 h-12 w-full rounded-2xl bg-white px-4 text-base font-black text-stone-900 ring-2 ring-stone-200 tabular-nums focus:outline-none focus-visible:ring-4 dark:bg-stone-900 dark:text-white dark:ring-stone-800 ${focus}`}
      />
    </label>
  );
}

function MultiplicandsPicker({
  setup,
  onChange,
  theme,
}: {
  setup: Extract<OperationSetup, { kind: "multiplicands" }>;
  onChange: (s: OperationSetup) => void;
  theme: ReturnType<typeof useSettings>["theme"];
}) {
  const { t } = useTranslation();
  const set = new Set(setup.values);
  const toggle = (n: number) => {
    const next = new Set(set);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    onChange({ ...setup, values: [...next].sort((a, b) => a - b) });
  };
  return (
    <section className="mb-6">
      <SectionHeading>{t("setup.multiplicands")}</SectionHeading>
      <div className="grid grid-cols-5 gap-2.5">
        {MULTIPLICANDS.map((n) => {
          const active = set.has(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => toggle(n)}
              className={`h-14 rounded-2xl text-xl font-black tabular-nums ring-2 transition active:scale-[0.95] focus-visible:outline-none focus-visible:ring-4 ${theme.primaryFocus} ${
                active
                  ? `${theme.primary} text-white ring-transparent shadow-sm ${theme.primaryShadow}`
                  : "bg-white text-stone-700 ring-stone-200 hover:ring-stone-300 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-800 dark:hover:ring-stone-700"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function LengthPicker({
  setup,
  onChange,
  theme,
}: {
  setup: OperationSetup;
  onChange: (s: OperationSetup) => void;
  theme: ReturnType<typeof useSettings>["theme"];
}) {
  const { t } = useTranslation();
  const isTime = setup.timeMs !== undefined;
  const setMode = (mode: "count" | "time") => {
    if (mode === "count" && isTime) {
      onChange({ ...setup, timeMs: undefined, rounds: setup.rounds || 20 });
    } else if (mode === "time" && !isTime) {
      onChange({ ...setup, timeMs: 300_000 });
    }
  };

  const activeBtn = `${theme.primary} text-white ring-transparent shadow-sm ${theme.primaryShadow}`;
  const inactiveBtn =
    "bg-white text-stone-700 ring-stone-200 hover:ring-stone-300 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-800 dark:hover:ring-stone-700";

  return (
    <section className="mb-6">
      <SectionHeading>{t("setup.lengthSection")}</SectionHeading>

      <div className="mb-3 grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => setMode("count")}
          className={`flex h-12 items-center justify-center rounded-2xl text-base font-black ring-2 transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 ${theme.primaryFocus} ${
            !isTime ? activeBtn : inactiveBtn
          }`}
        >
          {t("setup.modeCount")}
        </button>
        <button
          type="button"
          onClick={() => setMode("time")}
          className={`flex h-12 items-center justify-center rounded-2xl text-base font-black ring-2 transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 ${theme.primaryFocus} ${
            isTime ? activeBtn : inactiveBtn
          }`}
        >
          {t("setup.modeTime")}
        </button>
      </div>

      {isTime ? (
        <TimePicker setup={setup} onChange={onChange} theme={theme} />
      ) : (
        <RoundsPicker setup={setup} onChange={onChange} theme={theme} />
      )}
    </section>
  );
}

function RoundsPicker({
  setup,
  onChange,
  theme,
}: {
  setup: OperationSetup;
  onChange: (s: OperationSetup) => void;
  theme: ReturnType<typeof useSettings>["theme"];
}) {
  const { t } = useTranslation();
  const isPreset = ROUND_SIZE_OPTIONS.includes(
    setup.rounds as (typeof ROUND_SIZE_OPTIONS)[number],
  );
  return (
    <>
      <div className="grid grid-cols-4 gap-2.5">
        {ROUND_SIZE_OPTIONS.map((n) => {
          const active = setup.rounds === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange({ ...setup, rounds: n })}
              className={`flex h-12 items-center justify-center rounded-2xl text-base font-black tabular-nums ring-2 transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 ${theme.primaryFocus} ${
                active
                  ? `${theme.primary} text-white ring-transparent shadow-sm ${theme.primaryShadow}`
                  : "bg-white text-stone-700 ring-stone-200 hover:ring-stone-300 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-800 dark:hover:ring-stone-700"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onChange({ ...setup, rounds: 25 })}
        className={`mt-2.5 flex h-12 w-full items-center justify-center rounded-2xl px-4 text-base font-black ring-2 transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 ${theme.primaryFocus} ${
          !isPreset
            ? `${theme.primary} text-white ring-transparent shadow-sm ${theme.primaryShadow}`
            : "bg-white text-stone-700 ring-stone-200 hover:ring-stone-300 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-800 dark:hover:ring-stone-700"
        }`}
      >
        {t("setup.customRounds")}
      </button>
      {!isPreset && (
        <div className="mt-3">
          <NumberField
            label={t("setup.rounds")}
            value={setup.rounds}
            min={1}
            max={999}
            onChange={(v) => onChange({ ...setup, rounds: v })}
            focus={theme.primaryFocus}
          />
        </div>
      )}
    </>
  );
}

function TimePicker({
  setup,
  onChange,
  theme,
}: {
  setup: OperationSetup;
  onChange: (s: OperationSetup) => void;
  theme: ReturnType<typeof useSettings>["theme"];
}) {
  const { t } = useTranslation();
  const currentMs = setup.timeMs ?? 0;
  const isPreset = TIME_OPTIONS_MS.includes(
    currentMs as (typeof TIME_OPTIONS_MS)[number],
  );
  const customMinutes = Math.max(1, Math.round(currentMs / 60_000));
  return (
    <>
      <div className="grid grid-cols-4 gap-2.5">
        {TIME_OPTIONS_MS.map((ms) => {
          const active = currentMs === ms;
          const minutes = ms / 60_000;
          return (
            <button
              key={ms}
              type="button"
              onClick={() => onChange({ ...setup, timeMs: ms })}
              className={`flex h-12 items-center justify-center rounded-2xl text-base font-black tabular-nums ring-2 transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 ${theme.primaryFocus} ${
                active
                  ? `${theme.primary} text-white ring-transparent shadow-sm ${theme.primaryShadow}`
                  : "bg-white text-stone-700 ring-stone-200 hover:ring-stone-300 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-800 dark:hover:ring-stone-700"
              }`}
            >
              {minutes}m
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onChange({ ...setup, timeMs: 7 * 60_000 })}
        className={`mt-2.5 flex h-12 w-full items-center justify-center rounded-2xl px-4 text-base font-black ring-2 transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 ${theme.primaryFocus} ${
          !isPreset
            ? `${theme.primary} text-white ring-transparent shadow-sm ${theme.primaryShadow}`
            : "bg-white text-stone-700 ring-stone-200 hover:ring-stone-300 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-800 dark:hover:ring-stone-700"
        }`}
      >
        {t("setup.customRounds")}
      </button>
      {!isPreset && (
        <div className="mt-3">
          <NumberField
            label={t("setup.minutesShort")}
            value={customMinutes}
            min={1}
            max={120}
            onChange={(v) => onChange({ ...setup, timeMs: v * 60_000 })}
            focus={theme.primaryFocus}
          />
        </div>
      )}
    </>
  );
}
