import { Outlet, useLocation } from 'react-router-dom';
import { useTokenStore } from '@/lib/auth/token';
import AppShell from '@/components/layout/AppShell';
import Footer from '@/components/layout/Footer';
import CookieBanner from '@/components/CookieBanner';

export default function Layout() {
  const session = useTokenStore((s) => s.session);
  const location = useLocation();
  const isAuthPage = ['/login', '/register', '/verify-email', '/forgot-password'].includes(location.pathname);
  if (session && !isAuthPage) {
    return (
      <AppShell>
        <Outlet />
      </AppShell>
    );
  }
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
}
