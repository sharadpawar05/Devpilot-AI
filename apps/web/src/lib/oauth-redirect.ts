const STORAGE_KEY = 'github_oauth_return';

const ALLOWED_PREFIXES = [
  '/dashboard',
  '/github',
  '/pull-request-assistant',
  '/repository-chat',
  '/playground',
  '/code-review',
];

export function saveReturnUrl(url?: string): void {
  const returnUrl = url || getCurrentPath();
  if (!validateReturnUrl(returnUrl)) return;
  try {
    localStorage.setItem(STORAGE_KEY, returnUrl);
  } catch {
    /* noop */
  }
}

export function getReturnUrl(): string | null {
  try {
    const url = localStorage.getItem(STORAGE_KEY);
    if (url && validateReturnUrl(url)) return url;
  } catch {
    /* noop */
  }
  return null;
}

export function clearReturnUrl(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

export function validateReturnUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  if (!url.startsWith('/')) return false;
  if (url.includes('://') || url.includes('..') || url.includes('\0')) return false;
  return ALLOWED_PREFIXES.some((prefix) => url === prefix || url.startsWith(prefix + '/'));
}

function getCurrentPath(): string {
  try {
    return window.location.pathname;
  } catch {
    return '/dashboard';
  }
}
