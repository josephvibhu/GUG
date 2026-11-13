"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";

export type LanguageCode = "en" | "tr" | "id";

export interface LanguageOption {
  code: LanguageCode;
  name: string;
  short: string;
  flag: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en", name: "English", short: "EN", flag: "🇬🇧" },
  { code: "tr", name: "Türkçe", short: "TR", flag: "🇹🇷" },
  { code: "id", name: "Bahasa Indonesia", short: "ID", flag: "🇮🇩" },
];

export const translations = {
  en: {
    // Brand & Header
    "brand.name": "Grow Ur Gold",
    "brand.tagline": "Parlamentum Sovereign Stock Exchange",
    "nav.markets": "Markets",
    "nav.trade": "Trade",
    "nav.portfolio": "Portfolio",
    "nav.auction": "Auction",
    "nav.listCompany": "List a company",
    "nav.listShort": "List",
    "nav.crypto": "Crypto",
    "nav.funds": "Funds",
    "nav.referrals": "Referrals",
    "nav.operatorDesk": "Operator Desk",
    "nav.operator": "Operator",
    "nav.soon": "soon",
    "nav.login": "Log In",
    "nav.logout": "Log Out",
    "nav.purse": "Purse",
    "nav.gold": "gold",
    "nav.deposit": "Deposit",
    "nav.withdraw": "Withdraw",
    "nav.admin": "Admin Desk",
    "nav.settings": "Settings",

    // Market Status / Floor Clock
    "clock.floorOpen": "FLOOR OPEN",
    "clock.floorClosed": "FLOOR CLOSED",
    "clock.247Continuous": "24/7 Trading Floor Active",
    "clock.warEmergency": "WORLD WAR EMERGENCY: The exchange floor is CLOSED due to the World War.",

    // Markets Page Table & Stats
    "markets.title": "Parlamentum Equities & Sovereign Bourse",
    "markets.subtitle": "Trade corporate shares for in-game gold. Real-time matching, weekly Friday dividends.",
    "markets.searchPlaceholder": "Search by ticker, company, or founder...",
    "markets.thTicker": "Ticker",
    "markets.thCompany": "Company",
    "markets.thPrice": "Price",
    "markets.th24h": "24h Change",
    "markets.thVolume": "24h Vol",
    "markets.thMarketCap": "Market Cap",
    "markets.thDividends": "Dividend Pool",
    "markets.thActions": "Trade",
    "markets.allSectors": "All Sectors",
    "markets.financial": "Financial Services",
    "markets.manufacturing": "Manufacturing & Mining",
    "markets.media": "Media & News",
    "markets.conglomerate": "Conglomerate",
    "markets.stateOwned": "State Enterprise",
    "markets.activeAsks": "Asks",
    "markets.activeBids": "Bids",
    "markets.primaryRound": "Primary Offering",

    // Trade Terminal
    "trade.buy": "Buy",
    "trade.sell": "Sell",
    "trade.limit": "Limit Order",
    "trade.market": "Market Order",
    "trade.price": "Price",
    "trade.shares": "Shares",
    "trade.total": "Total",
    "trade.balance": "Balance",
    "trade.placeBuy": "Place Buy Order",
    "trade.placeSell": "Place Sell Order",
    "trade.orderBook": "Order Book",
    "trade.marketHistory": "Recent Trades",
    "trade.spread": "Spread",
    "trade.openOrders": "My Open Orders",
    "trade.noOpenOrders": "No open orders",
    "trade.cancel": "Cancel",
    "trade.depth": "Market Depth",
    "trade.dividendYield": "Dividend Yield",
    "trade.weeklyRevenue": "Weekly Revenue",
    "trade.sharesSold": "Float Sold",
    "trade.dilutionCap": "Fixed Supply Cap",

    // Wallet Modal
    "wallet.title": "Citizen Purse",
    "wallet.tabDeposit": "Deposit Gold",
    "wallet.tabWithdraw": "Withdraw Gold",
    "wallet.tabHistory": "Ledger & History",
    "wallet.availableCash": "Available Cash",
    "wallet.lockedOrders": "Locked in Orders",
    "wallet.totalPurse": "Total Net Worth",
    "wallet.depositIron": "Deposit via Raw Iron (10g), Cotton (100g), or Copper (1k)",
    "wallet.depositBtn": "I Bought The Items · Credit Purse",
    "wallet.withdrawBtn": "Request In-Game Withdrawal",
    "wallet.minWithdrawNotice": "Minimum cash out is {min} gold. Processed every Friday.",
    "wallet.slaNotice": "48-Hour In-Game Fulfillment SLA",

    // Footer
    "footer.disclaimer": "Played with Parlamentum gold only: no real money goes in or comes out. Grow Ur Gold is an independent player project, not run by the Parlamentum team.",
    "footer.terms": "Terms",
    "footer.goldRules": "Gold rules",
    "footer.operator": "Operator",
    "footer.allRights": "All rights reserved.",

    // General & Status
    "common.loading": "Loading...",
    "common.confirm": "Confirm",
    "common.cancel": "Cancel",
    "common.close": "Close",
    "common.save": "Save",
    "common.saved": "Saved",
    "common.error": "Something went wrong",
    "common.copy": "Copy",
    "common.copied": "Copied!",
  },
  tr: {
    // Brand & Header
    "brand.name": "Grow Ur Gold",
    "brand.tagline": "Parlamentum Bağımsız Menkul Kıymetler Borsası",
    "nav.markets": "Piyasalar",
    "nav.trade": "İşlem Yap",
    "nav.portfolio": "Portföy",
    "nav.auction": "Açık Artırma",
    "nav.listCompany": "Şirket Listele",
    "nav.listShort": "Listele",
    "nav.crypto": "Kripto",
    "nav.funds": "Fonlar",
    "nav.referrals": "Referanslar",
    "nav.operatorDesk": "Operatör Masası",
    "nav.operator": "Operatör",
    "nav.soon": "yakında",
    "nav.login": "Giriş Yap",
    "nav.logout": "Çıkış Yap",
    "nav.purse": "Kese",
    "nav.gold": "altın",
    "nav.deposit": "Para Yatır",
    "nav.withdraw": "Para Çek",
    "nav.admin": "Yönetici Masası",
    "nav.settings": "Ayarlar",

    // Market Status / Floor Clock
    "clock.floorOpen": "BORSA AÇIK",
    "clock.floorClosed": "BORSA KAPALI",
    "clock.247Continuous": "7/24 Kesintisiz İşlem Seansı Aktif",
    "clock.warEmergency": "DÜNYA SAVAŞI OLAĞANÜSTÜ HALİ: Borsa salonu Dünya Savaşı nedeniyle KAPALIDIR.",

    // Markets Page Table & Stats
    "markets.title": "Parlamentum Hisse Senetleri ve Borsa",
    "markets.subtitle": "Oyun içi altınla şirket hisseleri alıp satın. Anlık eşleşme motoru ve haftalık Cuma temettüleri.",
    "markets.searchPlaceholder": "Sembol, şirket veya kurucu adına göre ara...",
    "markets.thTicker": "Sembol",
    "markets.thCompany": "Şirket",
    "markets.thPrice": "Fiyat",
    "markets.th24h": "24s Değişim",
    "markets.thVolume": "24s Hacim",
    "markets.thMarketCap": "Piyasa Değeri",
    "markets.thDividends": "Temettü Havuzu",
    "markets.thActions": "İşlem",
    "markets.allSectors": "Tüm Sektörler",
    "markets.financial": "Finansal Hizmetler",
    "markets.manufacturing": "Üretim ve Madencilik",
    "markets.media": "Medya ve Haber",
    "markets.conglomerate": "Holding",
    "markets.stateOwned": "Devlet Teşekkülü",
    "markets.activeAsks": "Satışlar",
    "markets.activeBids": "Alışlar",
    "markets.primaryRound": "Birincil Halka Arz",

    // Trade Terminal
    "trade.buy": "Satın Al",
    "trade.sell": "Sat",
    "trade.limit": "Limit Emir",
    "trade.market": "Piyasa Emri",
    "trade.price": "Fiyat",
    "trade.shares": "Hisse Adedi",
    "trade.total": "Toplam",
    "trade.balance": "Bakiye",
    "trade.placeBuy": "Alış Emri Ver",
    "trade.placeSell": "Satış Emri Ver",
    "trade.orderBook": "Emir Defteri",
    "trade.marketHistory": "Son İşlemler",
    "trade.spread": "Fark (Spread)",
    "trade.openOrders": "Açık Emirlerim",
    "trade.noOpenOrders": "Açık emir bulunmuyor",
    "trade.cancel": "İptal Et",
    "trade.depth": "Piyasa Derinliği",
    "trade.dividendYield": "Temettü Getirisi",
    "trade.weeklyRevenue": "Haftalık Gelir",
    "trade.sharesSold": "Satılan Halka Arz",
    "trade.dilutionCap": "Sabit Hisse Limiti",

    // Wallet Modal
    "wallet.title": "Vatandaş Kesesi",
    "wallet.tabDeposit": "Altın Yatır",
    "wallet.tabWithdraw": "Altın Çek",
    "wallet.tabHistory": "İşlem Defteri",
    "wallet.availableCash": "Kullanılabilir Nakit",
    "wallet.lockedOrders": "Emirlerde Kilitli",
    "wallet.totalPurse": "Toplam Varlık",
    "wallet.depositIron": "Ham Demir (10a), Pamuk (100a) veya Bakır (1k) ile Yatır",
    "wallet.depositBtn": "Eşyaları Satın Aldım · Bakiyemi Yükle",
    "wallet.withdrawBtn": "Oyun İçi Çekim Talebi Oluştur",
    "wallet.minWithdrawNotice": "Minimum çekim miktarı {min} altındır. Her Cuma işlenir.",
    "wallet.slaNotice": "48 Saatlik Oyun İçi Teslimat Garantisi (SLA)",

    // Footer
    "footer.disclaimer": "Yalnızca Parlamentum altını ile oynanır: sisteme gerçek para girmez ve çıkmaz. Grow Ur Gold bağımsız bir oyuncu projesidir, resmi Parlamentum ekibi tarafından işletilmemektedir.",
    "footer.terms": "Kullanım Koşulları",
    "footer.goldRules": "Altın Kuralları",
    "footer.operator": "Operatör",
    "footer.allRights": "Tüm hakları saklıdır.",

    // General & Status
    "common.loading": "Yükleniyor...",
    "common.confirm": "Onayla",
    "common.cancel": "İptal",
    "common.close": "Kapat",
    "common.save": "Kaydet",
    "common.saved": "Kaydedildi",
    "common.error": "Bir hata oluştu",
    "common.copy": "Kopyala",
    "common.copied": "Kopyalandı!",
  },
  id: {
    // Brand & Header
    "brand.name": "Grow Ur Gold",
    "brand.tagline": "Bursa Efek Berdaulat Parlamentum",
    "nav.markets": "Pasar",
    "nav.trade": "Perdagangan",
    "nav.portfolio": "Portofolio",
    "nav.auction": "Lelang",
    "nav.listCompany": "Daftarkan Perusahaan",
    "nav.listShort": "Daftar",
    "nav.crypto": "Kripto",
    "nav.funds": "Dana",
    "nav.referrals": "Rujukan",
    "nav.operatorDesk": "Meja Operator",
    "nav.operator": "Operator",
    "nav.soon": "segera",
    "nav.login": "Masuk",
    "nav.logout": "Keluar",
    "nav.purse": "Dompet",
    "nav.gold": "emas",
    "nav.deposit": "Setor",
    "nav.withdraw": "Tarik",
    "nav.admin": "Meja Admin",
    "nav.settings": "Pengaturan",

    // Market Status / Floor Clock
    "clock.floorOpen": "LANTAI BUKA",
    "clock.floorClosed": "LANTAI TUTUP",
    "clock.247Continuous": "Sesi Perdagangan Non-Stop 24/7 Aktif",
    "clock.warEmergency": "DARURAT PERANG DUNIA: Lantai bursa DITUTUP karena Perang Dunia.",

    // Markets Page Table & Stats
    "markets.title": "Saham Perusahaan & Bursa Parlamentum",
    "markets.subtitle": "Perdagangkan saham perusahaan dengan emas dalam game. Pencocokan langsung & dividen setiap hari Jumat.",
    "markets.searchPlaceholder": "Cari berdasarkan kode, perusahaan, atau pendiri...",
    "markets.thTicker": "Kode",
    "markets.thCompany": "Perusahaan",
    "markets.thPrice": "Harga",
    "markets.th24h": "Perubahan 24j",
    "markets.thVolume": "Vol 24j",
    "markets.thMarketCap": "Kapitalisasi Pasar",
    "markets.thDividends": "Kolam Dividen",
    "markets.thActions": "Aksi",
    "markets.allSectors": "Semua Sektor",
    "markets.financial": "Layanan Keuangan",
    "markets.manufacturing": "Manufaktur & Tambang",
    "markets.media": "Media & Berita",
    "markets.conglomerate": "Konglomerat",
    "markets.stateOwned": "Perusahaan Negara",
    "markets.activeAsks": "Jual",
    "markets.activeBids": "Beli",
    "markets.primaryRound": "Penawaran Perdana",

    // Trade Terminal
    "trade.buy": "Beli",
    "trade.sell": "Jual",
    "trade.limit": "Pesanan Batas",
    "trade.market": "Pesanan Pasar",
    "trade.price": "Harga",
    "trade.shares": "Jumlah Saham",
    "trade.total": "Total",
    "trade.balance": "Saldo",
    "trade.placeBuy": "Pasang Pesanan Beli",
    "trade.placeSell": "Pasang Pesanan Jual",
    "trade.orderBook": "Buku Pesanan",
    "trade.marketHistory": "Riwayat Perdagangan",
    "trade.spread": "Selisih (Spread)",
    "trade.openOrders": "Pesanan Terbuka Saya",
    "trade.noOpenOrders": "Tidak ada pesanan terbuka",
    "trade.cancel": "Batal",
    "trade.depth": "Kedalaman Pasar",
    "trade.dividendYield": "Hasil Dividen",
    "trade.weeklyRevenue": "Pendapatan Mingguan",
    "trade.sharesSold": "Saham Terjual",
    "trade.dilutionCap": "Batas Pasokan Saham Tetap",

    // Wallet Modal
    "wallet.title": "Dompet Warga",
    "wallet.tabDeposit": "Setor Emas",
    "wallet.tabWithdraw": "Tarik Emas",
    "wallet.tabHistory": "Buku Kas & Riwayat",
    "wallet.availableCash": "Uang Tunai Tersedia",
    "wallet.lockedOrders": "Terkunci dalam Pesanan",
    "wallet.totalPurse": "Total Nilai Bersih",
    "wallet.depositIron": "Setor via Besi Mentah (10e), Kapas (100e), atau Tembaga (1k)",
    "wallet.depositBtn": "Saya Sudah Beli Barang · Isi Saldo Dompet",
    "wallet.withdrawBtn": "Ajukan Penarikan Dalam Game",
    "wallet.minWithdrawNotice": "Penarikan minimum adalah {min} emas. Diproses setiap hari Jumat.",
    "wallet.slaNotice": "Jaminan Pengiriman Dalam Game 48 Jam (SLA)",

    // Footer
    "footer.disclaimer": "Hanya dimainkan dengan emas Parlamentum: tidak ada uang sungguhan yang masuk atau keluar. Grow Ur Gold adalah proyek pemain independen, tidak dioperasikan oleh tim resmi Parlamentum.",
    "footer.terms": "Syarat & Ketentuan",
    "footer.goldRules": "Aturan Emas",
    "footer.operator": "Operator",
    "footer.allRights": "Hak cipta dilindungi.",

    // General & Status
    "common.loading": "Memuat...",
    "common.confirm": "Konfirmasi",
    "common.cancel": "Batal",
    "common.close": "Tutup",
    "common.save": "Simpan",
    "common.saved": "Tersimpan",
    "common.error": "Terjadi kesalahan",
    "common.copy": "Salin",
    "common.copied": "Tersalin!",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

interface I18nContextType {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  languages: LanguageOption[];
}

const I18nContext = createContext<I18nContextType>({
  lang: "en",
  setLang: () => {},
  t: (key) => key,
  languages: LANGUAGES,
});

const STORAGE_KEY = "gug_lang";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>("en");

  // Read saved language from localStorage or cookies on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
      if (saved && (saved === "en" || saved === "tr" || saved === "id")) {
        setLangState(saved);
        document.documentElement.lang = saved;
        return;
      }
      // Check cookies
      const match = document.cookie.match(/(?:^|;\s*)gug_lang=([^;]+)/);
      if (match && (match[1] === "en" || match[1] === "tr" || match[1] === "id")) {
        setLangState(match[1] as LanguageCode);
        document.documentElement.lang = match[1];
        return;
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const setLang = (newLang: LanguageCode) => {
    setLangState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
      document.cookie = `gug_lang=${newLang};path=/;max-age=31536000;SameSite=Lax`;
      document.documentElement.lang = newLang;
      window.dispatchEvent(new CustomEvent("gug_lang_changed", { detail: newLang }));
    } catch {
      // Ignore
    }
  };

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const dict = translations[lang] || translations.en;
    let text: string = (dict as any)[key] || (translations.en as any)[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return text;
  };

  const value = useMemo(() => ({ lang, setLang, t, languages: LANGUAGES }), [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

/**
 * Colosseo-style Segmented Language Switcher (EN | TR | ID)
 * Sleek, dark bullion theme fitting Grow Ur Gold's visual identity.
 */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang, languages } = useI18n();

  return (
    <div
      className={`inline-flex items-center gap-0.5 bg-floor border border-rule rounded-[4px] p-0.5 select-none ${className}`}
      role="group"
      aria-label="language"
    >
      {languages.map((l) => {
        const isActive = lang === l.code;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => setLang(l.code)}
            lang={l.code}
            title={`${l.name} (${l.flag})`}
            className={`px-1.5 py-0.5 rounded-[3px] text-[11px] font-bold tabular transition-all cursor-pointer ${
              isActive
                ? "bg-bullion text-floor shadow-sm"
                : "text-ash hover:text-paper hover:bg-pane"
            }`}
          >
            {l.short}
          </button>
        );
      })}
    </div>
  );
}
