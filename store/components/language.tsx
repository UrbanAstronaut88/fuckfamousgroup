"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { translate } from "../lib/translations";
type Language = "uk" | "en";
const LanguageContext = createContext({
  language: "uk" as Language,
  setLanguage: (_: Language) => {},
  t: (uk: string, _en: string) => uk,
  tr: (text: string) => text,
});
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("uk");
  useEffect(() => {
    try {
      // Read the browser preference after hydration; SSR always starts in Ukrainian.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem("ffg-language") === "en") setLanguage("en");
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  function select(value: Language) {
    setLanguage(value);
    try {
      localStorage.setItem("ffg-language", value);
    } catch {}
  }
  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage: select,
        t: (uk, en) => (language === "en" ? en : uk),
        tr: (text) => translate(text, language),
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}
export const useLanguage = () => useContext(LanguageContext);
export function LanguageSwitch() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div
      className="language-switch"
      role="group"
      aria-label={t("Мова сайту", "Website language")}
    >
      {(["uk", "en"] as const).map((lang) => (
        <button
          key={lang}
          type="button"
          lang={lang}
          aria-label={lang === "uk" ? "Українська" : "English"}
          aria-pressed={language === lang}
          onClick={() => setLanguage(lang)}
        >
          {lang === "uk" ? "UKR" : "ENG"}
        </button>
      ))}
    </div>
  );
}
