import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Crestline Capital — Digital Banking Ecosystem',
  description: 'Modern digital banking for secure accounts, transfers, deposits and withdrawals.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}