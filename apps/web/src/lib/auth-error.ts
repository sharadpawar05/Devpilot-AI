export interface OAuthErrorParams {
  error: string;
  errorCode: string | null;
  errorDescription: string | null;
}

export interface AuthErrorCopy {
  title: string;
  message: string;
}

const GENERIC_COPY: AuthErrorCopy = {
  title: 'Sign-in failed',
  message: 'Something went wrong while signing you in. Please try again.',
};

const SERVICE_COPY: AuthErrorCopy = {
  title: 'Something went wrong',
  message:
    "We couldn't complete your sign-in. This is usually temporary — please try again in a moment.",
};

const SESSION_EXPIRED_COPY: AuthErrorCopy = {
  title: 'Session expired',
  message: 'Your sign-in session expired before we could finish. Please try again.',
};

const TRY_AGAIN_COPY: AuthErrorCopy = {
  title: "Sign-in couldn't be completed",
  message: "Something didn't match up. Please try signing in again.",
};

const AUTH_ERROR_COPY: Record<string, AuthErrorCopy> = {
  access_denied: {
    title: 'Sign-in cancelled',
    message:
      'Your sign-in request was cancelled or denied. Please try again and approve the request to continue.',
  },
  server_error: SERVICE_COPY,
  unexpected_failure: SERVICE_COPY,
  temporarily_unavailable: {
    title: 'Sign-in temporarily unavailable',
    message: 'The sign-in service is busy right now. Please try again in a moment.',
  },
  invalid_redirect_uri: {
    title: 'Sign-in link not allowed',
    message: "This sign-in link isn't recognised. Please start again from the sign-in page.",
  },
  redirect_uri_mismatch: {
    title: 'Sign-in link not allowed',
    message: "This sign-in link isn't recognised. Please start again from the sign-in page.",
  },
  flow_state_not_found: SESSION_EXPIRED_COPY,
  flow_state_expired: SESSION_EXPIRED_COPY,
  flow_state_destroyed: SESSION_EXPIRED_COPY,
  session_expired: SESSION_EXPIRED_COPY,
  session_not_found: SESSION_EXPIRED_COPY,
  login_required: SESSION_EXPIRED_COPY,
  refresh_token_not_found: SESSION_EXPIRED_COPY,
  invalid_refresh_token: SESSION_EXPIRED_COPY,
  invalid_grant: SESSION_EXPIRED_COPY,
  invalid_request: TRY_AGAIN_COPY,
  invalid_client: TRY_AGAIN_COPY,
  validation_failed: TRY_AGAIN_COPY,
  bad_code_verifier: TRY_AGAIN_COPY,
  code_challenge_does_not_match: TRY_AGAIN_COPY,
  provider_disabled: {
    title: 'Sign-in method unavailable',
    message: 'That sign-in method is currently disabled. Please try another option.',
  },
  provider_not_found: {
    title: 'Sign-in method unavailable',
    message: 'That sign-in method is currently disabled. Please try another option.',
  },
  provider_email_needs_verification: {
    title: 'Verification required',
    message: 'Please verify your account with the sign-in provider, then try again.',
  },
  provider_id_needs_verification: {
    title: 'Verification required',
    message: 'Please verify your account with the sign-in provider, then try again.',
  },
  email_not_confirmed: {
    title: 'Email not confirmed',
    message: 'Please confirm your email address, then try signing in again.',
  },
  signup_disabled: {
    title: 'Sign-ups disabled',
    message: 'New accounts are currently disabled. Contact support if you think this is a mistake.',
  },
  over_email_send_rate_limit: {
    title: 'Too many attempts',
    message: 'Please wait a moment before trying again.',
  },
  over_sms_send_rate_limit: {
    title: 'Too many attempts',
    message: 'Please wait a moment before trying again.',
  },
  user_banned: {
    title: 'Account disabled',
    message: 'This account has been disabled. Contact support for help.',
  },
};

export function extractOAuthError(params: URLSearchParams): OAuthErrorParams | null {
  const error = params.get('error');
  if (!error) return null;
  return {
    error,
    errorCode: params.get('error_code'),
    errorDescription: params.get('error_description'),
  };
}

export function getOAuthErrorFromLocation(search: string, hash: string): OAuthErrorParams | null {
  const fromQuery = extractOAuthError(new URLSearchParams(search));
  if (fromQuery) return fromQuery;

  const rawHash = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!rawHash) return null;
  return extractOAuthError(new URLSearchParams(rawHash));
}

function sanitizeDescription(description: string | null): string | null {
  if (!description) return null;
  const cleaned = description
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 5) return null;
  return cleaned.length > 200 ? `${cleaned.slice(0, 200)}…` : cleaned;
}

export function getAuthErrorCopy(params: OAuthErrorParams | null): AuthErrorCopy {
  if (!params) return GENERIC_COPY;

  const key = (params.errorCode ?? params.error).toLowerCase();
  const mapped = AUTH_ERROR_COPY[key];
  if (mapped) return mapped;

  const description = sanitizeDescription(params.errorDescription);
  return {
    title: GENERIC_COPY.title,
    message: description ?? GENERIC_COPY.message,
  };
}
