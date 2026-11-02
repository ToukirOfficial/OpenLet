import type { Metadata, Viewport } from 'next';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'OpenLet: free property management for small landlords', template: '%s · OpenLet' },
  description: 'Free, open-source property and tenancy management for small landlords and letting agents. Rent, repairs, certificates and a tenant portal.',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = { themeColor: '#135e4b', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
