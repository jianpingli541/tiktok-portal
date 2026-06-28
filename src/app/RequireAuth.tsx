import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTokenStore } from '@/lib/auth/token';

/**
 * Pure Outlet guard. Renders <Outlet /> when authenticated, otherwise
 * redirects to /login preserving the attempted location.
 *
 * Usage (React Router v6 data API):
 *   <Route element={<RequireAuth />}>
 *     <Route path="account" element={<Account />} />
 *     ...
 *   </Route>
 *
 * Do NOT wrap children with <Layout /> here — the parent Layout must
 * remain the single renderer above all matched routes.
 */
export default function RequireAuth() {
  const session = useTokenStore((s) => s.session);
  const location = useLocation();
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
}