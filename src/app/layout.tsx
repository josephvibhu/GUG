import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import Footer from "@/components/Footer";

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

// viewport-fit=cover lets the phone tab bar sit above the iPhone home indicator (see globals.css)
export const viewport: Viewport = {
  themeColor: "#131722",
  viewportFit: "cover",
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
        <div className="flex-1 flex flex-col">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}
