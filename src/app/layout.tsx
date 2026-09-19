import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { template: '%s | Crestline Capital', default: 'Crestline Capital — Digital Banking' },
  description: 'Crestline Capital — secure digital banking for accounts, money movement, statements and account security.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}