import { useTranslation } from "react-i18next";
import { useSettings } from "../contexts/SettingsContext";
import { useAnswerVoice } from "../hooks/useAnswerVoice";
import { isSpeechRecognitionSupported } from "../lib/speech";
import type { Theme } from "../lib/themes";
import type { InputMode, Language } from "../lib/types";
import { DigitCanvas } from "./DigitCanvas";
import { NumPad, VoiceButton } from "./PracticeUI";
import type { Flash } from "./RoundChrome";

interface VoiceConfig {
  language: Language;
  /** Called with the full recognized number (submits like the numpad would). */
  onNumber: (n: number) => void;
  /** Changes per phase/problem to re-arm the auto-listen attempt budget. */
  gateKey: unknown;
}

/**
 * The answer-entry area for numeric input, with an on-the-fly switcher between
 * Numbers (numpad), Write (handwriting), and Talk (voice). Remembers the last
 * mode across problems via `settings.inputMode`. A drop-in for the bare
 * {@link NumPad}; renders the special pads (pickOp/compare/choice) stay in the
 * caller. Typing on a physical keyboard always works regardless of mode.
 */
export function AnswerInput({
  onDigits,
  onDelete,
  onConfirm,
  confirmDisabled,
  voice,
  theme,
  flash,
  trackedTimeout,
}: {
  onDigits: (digits: number[]) => void;
  onDelete: () => void;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  /** Omit to disable the Talk option (e.g. column mode is per-digit). */
  voice?: VoiceConfig;
  theme: Theme;
  flash: Flash;
  trackedTimeout: (fn: () => void, ms: number) => void;
}) {
  const { t } = useTranslation();
  const { settings, setInputMode } = useSettings();

  const talkAvailable =
    !!voice && (settings.voiceInput ?? false) && isSpeechRecognitionSupported();
  const modes: InputMode[] = talkAvailable
    ? ["pad", "write", "talk"]
    : ["pad", "write"];
  const stored = settings.inputMode ?? "pad";
  const mode: InputMode = modes.includes(stored) ? stored : "pad";

  return (
    <div>
      <ModeSwitcher
        modes={modes}
        active={mode}
        onPick={setInputMode}
        theme={theme}
        label={(m) => t(`input.${m}`)}
      />
      {mode === "pad" ? (
        <NumPad
          onDigit={(n) => onDigits([n])}
          onDelete={onDelete}
          onConfirm={onConfirm}
          confirmDisabled={confirmDisabled}
          theme={theme}
        />
      ) : mode === "write" ? (
        <DigitCanvas
          onDigits={onDigits}
          onDelete={onDelete}
          onConfirm={onConfirm}
          confirmDisabled={confirmDisabled}
          theme={theme}
          disabled={!!flash}
        />
      ) : (
        // Only mounted while Talk is active, so the mic engine starts on switch
        // and stops (hook cleanup) when switching away.
        <VoicePanel
          // biome-ignore lint/style/noNonNullAssertion: talk mode implies voice is set
          voice={voice!}
          flash={flash}
          theme={theme}
          trackedTimeout={trackedTimeout}
        />
      )}
    </div>
  );
}

function ModeSwitcher({
  modes,
  active,
  onPick,
  theme,
  label,
}: {
  modes: InputMode[];
  active: InputMode;
  onPick: (mode: InputMode) => void;
  theme: Theme;
  label: (mode: InputMode) => string;
}) {
  if (modes.length < 2) return null;
  return (
    <div className="px-4 pt-2">
      <div className="flex gap-1 rounded-2xl bg-stone-100 p-1 dark:bg-stone-800">
        {modes.map((m) => {
          const on = m === active;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onPick(m)}
              aria-pressed={on}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-sm font-black transition focus:outline-none focus-visible:ring-4 ${theme.primaryFocus} ${
                on
                  ? `bg-white shadow-sm ${theme.primaryText} ${theme.primaryTextDark} dark:bg-stone-900`
                  : "text-stone-500 dark:text-stone-400"
              }`}
            >
              <ModeIcon mode={m} />
              <span>{label(m)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ModeIcon({ mode }: { mode: InputMode }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (mode === "pad") {
    return (
      <svg {...common} aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8M8 12h8M8 17h4" />
      </svg>
    );
  }
  if (mode === "write") {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden="true">
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

function VoicePanel({
  voice,
  flash,
  theme,
  trackedTimeout,
}: {
  voice: VoiceConfig;
  flash: Flash;
  theme: Theme;
  trackedTimeout: (fn: () => void, ms: number) => void;
}) {
  const {
    voiceError,
    voicePaused,
    listening,
    speechActive,
    interim,
    onMicPress,
  } = useAnswerVoice({
    language: voice.language,
    enabled: true,
    gateOpen: true,
    gateKey: voice.gateKey,
    flash,
    onNumber: voice.onNumber,
    trackedTimeout,
  });
  return (
    <VoiceButton
      listening={listening}
      paused={voicePaused}
      speechActive={speechActive}
      interim={interim}
      error={voiceError}
      onPress={onMicPress}
      theme={theme}
    />
  );
}
