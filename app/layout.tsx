import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pitch Control Lab",
  description: "Interactive Spearman-style pitch control board",
  icons: {
    icon: "/pitch-control-labs-logo.png",
    shortcut: "/pitch-control-labs-logo.png",
    apple: "/pitch-control-labs-logo.png"
  },
  openGraph: {
    title: "Pitch Control Lab",
    description: "Interactive Spearman-style pitch control board",
    images: ["/pitch-control-labs-logo.png"]
  },
  twitter: {
    card: "summary",
    title: "Pitch Control Lab",
    description: "Interactive Spearman-style pitch control board",
    images: ["/pitch-control-labs-logo.png"]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
