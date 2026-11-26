import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono, Permanent_Marker } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "700"], variable: "--f-display" });
const text = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--f-text" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["500"], variable: "--f-mono" });
const marker = Permanent_Marker({ subsets: ["latin"], weight: "400", variable: "--f-marker" });

export const metadata: Metadata = {
  title: "GVG Body Map",
  description: "Galayn's daily home screen for GVG Brain",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0d1c6b" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${display.variable} ${text.variable} ${mono.variable} ${marker.variable}`}>
      <body>{children}</body>
    </html>
  );
}
