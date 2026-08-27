import type { Metadata } from "next";
import { Source_Sans_3, Libre_Franklin } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-source",
  subsets: ["latin"],
});

const display = Libre_Franklin({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Metallurgy Lab — Image Analysis SaaS",
  description:
    "Standards-aligned metallography analysis for grain size, inclusions, decarburization, micro and macro testing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sourceSans.variable} ${display.variable} antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
