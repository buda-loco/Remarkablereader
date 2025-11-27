import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reader App",
  description: "Distraction-free reading",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
