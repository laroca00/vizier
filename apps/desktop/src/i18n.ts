import { useSyncExternalStore } from "react";
import { EN } from "./i18n.en";
import { useSettings } from "./settings";

// Turkish is the source language: every string in the code is written in
// Turkish and doubles as its own key. English comes from i18n.en.ts.
// Placeholders look like {name} and are filled from the params object.

export type Lang = "tr" | "en";
export type LanguageSetting = "auto" | Lang;

let clientLocale: string | null = null;
const listeners = new Set<() => void>();

/** The League client's language ("tr_TR", "en_GB"); set once the client is connected. */
export function setClientLocale(locale: string | null) {
  if (locale === clientLocale) return;
  clientLocale = locale;
  for (const listener of listeners) listener();
}

function detected(): Lang {
  const locale = clientLocale ?? (typeof navigator === "undefined" ? "tr" : navigator.language);
  return locale.toLowerCase().startsWith("tr") ? "tr" : "en";
}

export type Params = Record<string, string | number>;

export function translate(lang: Lang, text: string, params?: Params): string {
  const template = lang === "en" ? (EN[text] ?? text) : text;
  return params ? template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in params ? String(params[key]) : whole)) : template;
}

export function useLang(): Lang {
  const { language } = useSettings();
  const auto = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    detected,
  );
  return language === "auto" ? auto : language;
}

export function useT() {
  const lang = useLang();
  return (text: string, params?: Params) => translate(lang, text, params);
}

/** Intl locale for numbers and relative times. */
export function intlLocale(lang: Lang) {
  return lang === "tr" ? "tr" : "en-GB";
}

/** "%52.4" in Turkish, "52.4%" in English. */
export function formatPercent(rate: number, lang: Lang, digits = 0) {
  const value = (rate * 100).toFixed(digits);
  return lang === "tr" ? `%${value}` : `${value}%`;
}
