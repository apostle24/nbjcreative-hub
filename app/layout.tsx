import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NBJCreative Hub | Digital products for your next big idea",
  description: "Discover practical digital products, creative resources and tools for business, work, learning and everyday life.",
  metadataBase: new URL("https://nbjcreative.com")
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}