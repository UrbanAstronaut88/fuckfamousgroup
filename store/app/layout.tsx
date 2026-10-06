import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "../components/language";
export const metadata: Metadata = {
  title: "Fuck Famous Group — Мерч",
  description:
    "Мерч та музика FCK FAMOUS GROUP. Для замовлення напиши менеджеру в Instagram або Telegram.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk">
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
