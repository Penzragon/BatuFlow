import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale } from "next-intl/server";
import { Toaster } from "sonner";
import { SessionProvider } from "@/components/providers/session-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BatuFlow - Distribution ERP",
  description:
    "BatuFlow - Distribution & Wholesale ERP. Manage sales, inventory, finance, and operations in one platform.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={`${inter.className} antialiased`}>
        <SessionProvider>
          <NextIntlClientProvider messages={messages} locale={locale}>
            {children}
            <Toaster richColors position="top-right" />
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
