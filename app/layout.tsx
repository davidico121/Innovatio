import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Archivo_Black, Open_Sans, Roboto } from "next/font/google";
import "./globals.css";
import { InstallProvider } from "./ui/InstallProvider";

// The design system's three voices: display (headlines, big numbers), sans (body), label (small caps text).
const display = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--ff-display", display: "swap" });
const sans = Open_Sans({ weight: ["400", "600", "700", "800"], style: ["normal", "italic"], subsets: ["latin"], variable: "--ff-sans", display: "swap" });
const label = Roboto({ weight: ["500", "700"], subsets: ["latin"], variable: "--ff-label", display: "swap" });

export const metadata: Metadata = {
  title: "Innovatio Team Tracker",
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.png?v=2", apple: "/apple-touch-icon.png?v=2" },
  appleWebApp: { capable: true, title: "Innovatio Team Tracker", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${label.variable}`}>
      <body>
        {/* Chrome can send its install event before the app has finished loading, so catch it first and hand it over. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__bip=e;window.dispatchEvent(new Event('bip-ready'));});",
          }}
        />
        <a href="#main" className="skip">Skip to content</a>
        <InstallProvider>{children}</InstallProvider>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js');}",
          }}
        />
      </body>
    </html>
  );
}
