import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WealthOS — Your money, in motion",
  description: "A calm, intelligent workspace for personal finance.",
  applicationName: "WealthOS"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
