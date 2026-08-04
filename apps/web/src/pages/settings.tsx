import { SettingsLayout } from '@/components/settings';
import { SettingsProvider } from '@/lib/settings-context';

export default function SettingsPage() {
  return (
    <SettingsProvider>
      <SettingsLayout />
    </SettingsProvider>
  );
}
