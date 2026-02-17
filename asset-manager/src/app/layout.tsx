import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from '@/components/Sidebar';
import AppProviders from '@/components/AppProviders';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Asset Manager',
  description: 'Track your wealth with precision.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AppProviders>
          <div className="flex bg-slate-50 min-h-screen text-slate-900">
            <Sidebar />
            <main className="flex-1 ml-64 p-8 transition-all duration-300">
              {children}
            </main>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
