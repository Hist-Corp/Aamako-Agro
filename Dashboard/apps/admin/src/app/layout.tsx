import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/config/providers';

export const metadata: Metadata = {
  title: 'आमाको एग्रो — Admin Dashboard',
  description: 'Internal operations dashboard for आमाको एग्रो',
};

// Runs synchronously before first paint: paints the document AND body
// background to match the route (dark for the sign-in page, light for the
// app) so refreshing never flashes white — on the login page or inside.
const themeInitScript = `
try {
  var dark = window.location.pathname === '/login';
  var c = dark ? '#101812' : '#f8fafc';
  document.documentElement.style.backgroundColor = c;
  document.body.style.backgroundColor = c;
} catch (e) {}
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ backgroundColor: '#f8fafc' }}>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
