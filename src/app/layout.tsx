import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Crestline Capital — Digital Banking Ecosystem',
  description: 'Modern digital banking for secure accounts, transfers, deposits and withdrawals.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}