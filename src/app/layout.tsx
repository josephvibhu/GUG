import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

// One variable family: normal width for the interface, condensed for symbols and prices (see globals.css)
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: "Grow Ur Gold",
  description: "The player-run stock exchange of Parlamentum. Trade company shares for in-game gold, list your company, collect Friday dividends.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100 selection:bg-amber-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
