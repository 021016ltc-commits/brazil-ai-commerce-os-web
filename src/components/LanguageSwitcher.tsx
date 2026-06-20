"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { localeOptions, type LocaleCode } from "@/locales/app";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, dictionary } = useLanguage();

  return (
    <label className={compact ? "flex items-center gap-2 text-xs text-slate-600" : "grid gap-2 text-sm text-slate-600"}>
      <span className="inline-flex items-center gap-2 font-medium text-ink">
        <Languages className="h-4 w-4 text-teal-700" aria-hidden="true" />
        {compact ? dictionary.common.chooseLanguage : dictionary.common.languageAndInterface}
      </span>
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as LocaleCode)}
        className="h-10 rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
      >
        {localeOptions.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
