"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  dictionaries,
  isLocaleCode,
  type AppDictionary,
  type LocaleCode,
} from "@/locales/app";

const STORAGE_KEY = "baico_locale";

type LanguageContextValue = {
  locale: LocaleCode;
  dictionary: AppDictionary;
  setLocale: (locale: LocaleCode) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>("zh-CN");

  useEffect(() => {
    const storedLocale = window.localStorage.getItem(STORAGE_KEY);
    if (isLocaleCode(storedLocale)) {
      setLocaleState(storedLocale);
      document.documentElement.lang = storedLocale;
    }
  }, []);

  const setLocale = (nextLocale: LocaleCode) => {
    setLocaleState(nextLocale);
    window.localStorage.setItem(STORAGE_KEY, nextLocale);
    document.documentElement.lang = nextLocale;
  };

  const value = useMemo(
    () => ({
      locale,
      dictionary: dictionaries[locale],
      setLocale,
    }),
    [locale],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return value;
}
