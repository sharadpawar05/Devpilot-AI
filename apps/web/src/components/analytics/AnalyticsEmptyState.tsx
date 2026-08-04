import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const AnalyticsEmptyState = memo(function AnalyticsEmptyState() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
        <BarChart3 className="h-10 w-10 text-primary" />
      </div>
      <h2 className="text-xl font-bold">No analytics yet</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Start using DevPilot to generate insights. Your usage data will appear here.
      </p>
      <Button onClick={() => navigate('/playground')} className="mt-6 gap-2">
        <Play className="h-4 w-4" />
        Open AI Playground
      </Button>
    </div>
  );
});
