"use client";

import { createContext, useContext } from "react";

import { getMessages, type Locale } from "~/lib/i18n";

const LocaleContext = createContext<{
  locale: Locale;
  messages: ReturnType<typeof getMessages>;
} | null>(null);

export function LocaleProvider(props: {
  children: React.ReactNode;
  locale: Locale;
}) {
  return (
    <LocaleContext.Provider
      value={{
        locale: props.locale,
        messages: getMessages(props.locale),
      }}
    >
      {props.children}
    </LocaleContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useI18n must be used inside LocaleProvider");
  }

  return context;
}
