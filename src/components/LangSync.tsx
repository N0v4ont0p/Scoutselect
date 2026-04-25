"use client";

import { useEffect } from "react";
import { useI18n } from "@/context/LanguageContext";

/**
 * Syncs the HTML `lang` attribute with the active language from LanguageContext.
 * This component must be rendered inside LanguageProvider.
 */
export default function LangSync() {
  const { lang } = useI18n();

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hans" : "en";
  }, [lang]);

  return null;
}
