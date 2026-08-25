import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/config/providers';

export const metadata: Metadata = {
  title: 'आमाको एग्रो — Admin Dashboard',
  description: 'Internal operations dashboard for आमाको एग्रो',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
