import { Component, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSettings } from "../contexts/SettingsContext";
import { Mascot } from "./Mascot";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) return <ErrorFallback />;
    return this.props.children;
  }
}

function ErrorFallback() {
  const { t } = useTranslation();
  const { theme, settings } = useSettings();
  const pageBg = settings.dark ? theme.pageBgDark : theme.pageBg;

  return (
    <div className={`min-h-dvh w-full ${pageBg}`}>
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center px-5 py-10 text-center">
        <Mascot size={108} mood="sad" theme={theme} />
        <h1 className="mt-5 text-3xl font-black tracking-tight text-stone-900 dark:text-white">
          {t("error.title")}
        </h1>
        <p className="mt-2 max-w-sm text-base leading-snug font-semibold text-stone-500 dark:text-stone-400">
          {t("error.body")}
        </p>
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={`flex h-14 items-center justify-center rounded-2xl px-6 text-base font-black text-white shadow-sm transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 ${theme.primary} ${theme.primaryHover} ${theme.primaryShadow} ${theme.primaryFocus}`}
          >
            {t("common.reload")}
          </button>
          <a
            href={import.meta.env.BASE_URL}
            className="flex h-14 items-center justify-center rounded-2xl bg-white px-6 text-base font-black text-stone-900 ring-1 ring-stone-200 transition active:scale-[0.98] dark:bg-stone-900 dark:text-white dark:ring-stone-800"
          >
            {t("common.goHome")}
          </a>
        </div>
      </div>
    </div>
  );
}
