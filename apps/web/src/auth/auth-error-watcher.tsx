import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getOAuthErrorFromLocation } from '@/lib/auth-error';

export function AuthErrorWatcher() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === '/auth/error') return;

    const oauthError = getOAuthErrorFromLocation(location.search, location.hash);
    if (!oauthError) return;

    const params = new URLSearchParams();
    params.set('error', oauthError.error);
    if (oauthError.errorCode) params.set('error_code', oauthError.errorCode);
    if (oauthError.errorDescription) {
      params.set('error_description', oauthError.errorDescription);
    }

    navigate({ pathname: '/auth/error', search: `?${params.toString()}` }, { replace: true });
  }, [location, navigate]);

  return <Outlet />;
}
