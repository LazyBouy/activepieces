import { isNil } from '@activepieces/core-utils';
import { t } from 'i18next';
import { useEffect } from 'react';

import { authenticationSession } from '@/lib/authentication-session';
import { useRedirectAfterLogin } from '@/lib/navigation-utils';

import { AuthDrawerBody, AuthMode } from './auth-drawer-body';
import { AuthCard, AuthPageShell } from './auth-page-shell';

export function AuthLanding({ initialMode }: AuthLandingProps) {
  const redirectAfterLogin = useRedirectAfterLogin();
  const signedIn =
    !isNil(authenticationSession.getToken()) &&
    !authenticationSession.isOnboarding();

  useEffect(() => {
    if (signedIn) {
      redirectAfterLogin();
    }
  }, [signedIn, redirectAfterLogin]);

  if (signedIn) {
    return null;
  }

  return (
    <AuthPageShell>
      <AuthCard
        aria-label={t('Sign in or create your account')}
        className="overflow-hidden p-0"
      >
        <AuthDrawerBody initialMode={initialMode} />
      </AuthCard>
    </AuthPageShell>
  );
}

type AuthLandingProps = {
  initialMode: AuthMode;
};
