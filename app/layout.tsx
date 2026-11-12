import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Team Tracker",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Team Tracker", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#111111" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: "0 auto",
          padding: 16,
          maxWidth: 900,
        }}
      >
        {children}
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
