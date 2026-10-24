import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export type ThemePreference = 'light' | 'dark' | 'system';
export type FontSize = 'small' | 'default' | 'large';
export type AccentColor = 'blue' | 'purple' | 'green' | 'orange' | 'pink';
export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'groq';
export type DefaultReviewType = 'quick' | 'standard' | 'deep';
export type DefaultReviewDepth = 'shallow' | 'moderate' | 'thorough';

export interface SettingsData {
  profile: {
    name: string;
    email: string;
    avatarUrl: string | null;
    timezone: string;
  };
  ai: {
    defaultProvider: AIProvider;
    defaultModel: string;
    temperature: number;
    maxTokens: number;
    streamResponses: boolean;
    markdownOutput: boolean;
    autoScroll: boolean;
    autoCopy: boolean;
    defaultReviewType: DefaultReviewType;
    defaultReviewDepth: DefaultReviewDepth;
  };
  github: {
    defaultRepository: string | null;
    defaultBranch: string | null;
  };
  appearance: {
    theme: ThemePreference;
    compactMode: boolean;
    fontSize: FontSize;
    accentColor: AccentColor;
  };
  notifications: {
    notifyReviewComplete: boolean;
    notifyPrAnalysis: boolean;
    notifyRepositorySync: boolean;
    notifyGithubAlerts: boolean;
    notifyWeeklySummary: boolean;
  };
}

export type ProfilePatch = { name?: string; timezone: string };
export type AIPatch = SettingsData['ai'];
export type GitHubPatch = SettingsData['github'];
export type AppearancePatch = SettingsData['appearance'];
export type NotificationsPatch = SettingsData['notifications'];

export interface AccountSession {
  id: string;
  createdAt: string | null;
  updatedAt: string | null;
  userAgent: string | null;
  ip: string | null;
  current: boolean;
}

function useApiFetch() {
  const { session } = useAuth();
  const token = session?.accessToken;
  return async (path: string, init?: RequestInit): Promise<Response> => {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
    return res;
  };
}

function unwrap<T>(res: Response): Promise<T> {
  return res.json().then((body: { success?: boolean; error?: { message?: string } } & T) => {
    if (!res.ok || body.success === false) {
      throw new Error(body.error?.message ?? `Request failed (${res.status})`);
    }
    return body;
  });
}

export function useSettingsQuery() {
  const apiFetch = useApiFetch();
  const { session } = useAuth();
  return useQuery({
    queryKey: ['settings'],
    queryFn: async (): Promise<SettingsData> => {
      const body = await apiFetch('/settings').then(
        unwrap<Omit<SettingsData, 'profile'> & { profile: SettingsData['profile'] }>,
      );
      return {
        profile: body.profile,
        ai: body.ai,
        github: body.github,
        appearance: body.appearance,
        notifications: body.notifications,
      };
    },
    enabled: !!session,
    staleTime: 60_000,
  });
}

function useSectionMutation<TPatch>(path: string) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: TPatch): Promise<SettingsData> => {
      const body = await apiFetch(path, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }).then(unwrap<SettingsData>);
      return {
        profile: body.profile,
        ai: body.ai,
        github: body.github,
        appearance: body.appearance,
        notifications: body.notifications,
      };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
}

export function useUpdateProfile() {
  return useSectionMutation<ProfilePatch>('/settings/profile');
}
export function useUpdateAI() {
  return useSectionMutation<AIPatch>('/settings/ai');
}
export function useUpdateGitHub() {
  return useSectionMutation<GitHubPatch>('/settings/github');
}
export function useUpdateAppearance() {
  return useSectionMutation<AppearancePatch>('/settings/appearance');
}
export function useUpdateNotifications() {
  return useSectionMutation<NotificationsPatch>('/settings/notifications');
}

export function useUploadAvatar() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dataUrl: string): Promise<SettingsData> => {
      const body = await apiFetch('/settings/avatar', {
        method: 'POST',
        body: JSON.stringify({ dataUrl }),
      }).then(unwrap<SettingsData>);
      return {
        profile: body.profile,
        ai: body.ai,
        github: body.github,
        appearance: body.appearance,
        notifications: body.notifications,
      };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
}

export function useDeleteAvatar() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<SettingsData> => {
      const body = await apiFetch('/settings/avatar', { method: 'DELETE' }).then(
        unwrap<SettingsData>,
      );
      return {
        profile: body.profile,
        ai: body.ai,
        github: body.github,
        appearance: body.appearance,
        notifications: body.notifications,
      };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
}

export function useAccountSessions() {
  const apiFetch = useApiFetch();
  const { session } = useAuth();
  return useQuery({
    queryKey: ['account-sessions'],
    queryFn: async (): Promise<{
      supported: boolean;
      currentSessionId: string | null;
      sessions: AccountSession[];
    }> => {
      const body = await apiFetch('/settings/account-sessions').then(
        unwrap<{ supported: boolean; currentSessionId: string | null; sessions: AccountSession[] }>,
      );
      return {
        supported: body.supported,
        currentSessionId: body.currentSessionId,
        sessions: body.sessions,
      };
    },
    enabled: !!session,
    staleTime: 30_000,
  });
}

export function useRevokeOtherSessions() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<number> => {
      const body = await apiFetch('/settings/account-sessions/revoke-others', {
        method: 'POST',
      }).then(unwrap<{ revoked: number }>);
      return body.revoked;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-sessions'] });
    },
  });
}

export function useStartAccountDeleteChallenge() {
  const apiFetch = useApiFetch();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      await apiFetch('/settings/account/delete-challenge', { method: 'POST' }).then(unwrap);
    },
  });
}

export function useDeleteAccount() {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      await apiFetch('/settings/account', {
        method: 'DELETE',
        body: JSON.stringify({ confirm: true }),
      }).then(unwrap);
    },
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
