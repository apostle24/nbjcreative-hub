import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NBJCreative Hub | Create. Learn. Earn. Work. Grow.",
  description: "A connected global platform for commerce, education, professional opportunities and business growth. Create. Learn. Earn. Work. Grow.",
  metadataBase: new URL("https://nbjcreative.com")
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}