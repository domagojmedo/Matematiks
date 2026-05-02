import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Mascot } from "../components/Mascot";
import { useSettings } from "../contexts/SettingsContext";

export function NotFound() {
  const { t } = useTranslation();
  const { theme, settings } = useSettings();
  const pageBg = settings.dark ? theme.pageBgDark : theme.pageBg;

  return (
    <div className={`min-h-dvh w-full ${pageBg}`}>
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center px-5 py-10 text-center">
        <Mascot size={108} mood="sad" theme={theme} />
        <p
          className={`mt-5 text-base font-black tracking-widest uppercase ${theme.primaryText} ${theme.primaryTextDark}`}
        >
          404
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-stone-900 dark:text-white">
          {t("notFound.title")}
        </h1>
        <p className="mt-2 max-w-sm text-base leading-snug font-semibold text-stone-500 dark:text-stone-400">
          {t("notFound.body")}
        </p>
        <Link
          to="/"
          className={`mt-6 flex h-14 items-center justify-center rounded-2xl px-6 text-base font-black text-white shadow-sm transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 ${theme.primary} ${theme.primaryHover} ${theme.primaryShadow} ${theme.primaryFocus}`}
        >
          {t("common.goHome")}
        </Link>
      </div>
    </div>
  );
}
