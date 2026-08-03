import { Code, Zap, Shield, Layers } from 'lucide-react';

export function ReviewEmptyState() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center max-w-xs">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
          <Code className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-sm font-semibold mb-1">Ready to review</h3>
        <p className="text-xs text-muted-foreground leading-relaxed mb-5">
          Paste or upload code on the left, then click review to get AI-powered analysis.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <FeatureCard icon={Zap} label="Performance" />
          <FeatureCard icon={Shield} label="Security" />
          <FeatureCard icon={Layers} label="Structure" />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-muted/30 p-2.5">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
    </div>
  );
}
