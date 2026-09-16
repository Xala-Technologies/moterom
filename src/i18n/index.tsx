import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import i18n from "i18next";
import {
  I18nextProvider,
  initReactI18next,
  useTranslation,
} from "react-i18next";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  LOCALE_LABELS,
  LOCALE_STORAGE_KEY,
  nextLocale,
  toBcp47,
  type Locale,
} from "../../shared/i18n/locale";
import {
  displayDate,
  formatCount,
  formatHours,
  money,
  shortTime,
} from "../../shared/time";
import nb from "./locales/nb.json";
import en from "./locales/en.json";

let initialized = false;

function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    /* optional */
  }
  const match = document.cookie
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${LOCALE_COOKIE}=`));
  if (match) {
    const value = decodeURIComponent(match.slice(LOCALE_COOKIE.length + 1));
    if (isLocale(value)) return value;
  }
  return DEFAULT_LOCALE;
}

export function writeLocalePreference(locale: Locale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* optional */
  }
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)};path=/;SameSite=Lax;max-age=31536000`;
  document.documentElement.lang = locale;
}

export function initI18n() {
  if (initialized) return i18n;
  const locale =
    typeof document !== "undefined" ? readStoredLocale() : DEFAULT_LOCALE;
  void i18n.use(initReactI18next).init({
    resources: {
      nb: { translation: nb },
      en: { translation: en },
    },
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  if (typeof document !== "undefined") {
    writeLocalePreference(locale);
  }
  initialized = true;
  return i18n;
}

initI18n();

type Formatters = {
  locale: Locale;
  bcp47: string;
  shortTime: (ms: number) => string;
  displayDate: (date: string | number, long?: boolean) => string;
  money: (amount: number | null, currency?: string) => string;
  formatHours: (hours: number) => string;
  formatCount: (value: number) => string;
};

const FormattersContext = createContext<Formatters | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { i18n: instance } = useTranslation();
  const locale = (
    isLocale(instance.language) ? instance.language : DEFAULT_LOCALE
  ) as Locale;
  const formatters = useMemo<Formatters>(() => {
    const bcp47 = toBcp47(locale);
    return {
      locale,
      bcp47,
      shortTime: (ms) => shortTime(ms, locale),
      displayDate: (date, long) => displayDate(date, long, locale),
      money: (amount, currency) => money(amount, currency, locale),
      formatHours: (hours) => formatHours(hours, locale),
      formatCount: (value) => formatCount(value, locale),
    };
  }, [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <I18nextProvider i18n={i18n}>
      <FormattersContext.Provider value={formatters}>
        {children}
      </FormattersContext.Provider>
    </I18nextProvider>
  );
}

export function useT() {
  const { t, i18n: instance } = useTranslation();
  return { t, i18n: instance };
}

export function useI18nLocale() {
  const { i18n: instance } = useTranslation();
  const locale = (
    isLocale(instance.language) ? instance.language : DEFAULT_LOCALE
  ) as Locale;
  const setLocale = (next: Locale) => {
    writeLocalePreference(next);
    void instance.changeLanguage(next);
  };
  const cycleLocale = () => setLocale(nextLocale(locale));
  return {
    locale,
    setLocale,
    cycleLocale,
    label: LOCALE_LABELS[locale].short,
    nativeLabel: LOCALE_LABELS[locale].native,
  };
}

export function useFormatters() {
  const value = useContext(FormattersContext);
  if (!value) {
    const locale = DEFAULT_LOCALE;
    return {
      locale,
      bcp47: toBcp47(locale),
      shortTime: (ms: number) => shortTime(ms, locale),
      displayDate: (date: string | number, long?: boolean) =>
        displayDate(date, long, locale),
      money: (amount: number | null, currency?: string) =>
        money(amount, currency, locale),
      formatHours: (hours: number) => formatHours(hours, locale),
      formatCount: (value: number) => formatCount(value, locale),
    };
  }
  return value;
}

export { roomCopy } from "../../shared/i18n/room";
export { LOCALE_LABELS, nextLocale, type Locale };
export { i18n };
