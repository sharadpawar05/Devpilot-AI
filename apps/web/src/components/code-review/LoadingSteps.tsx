import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

const STEPS = [
  { label: 'Parsing code structure', duration: 2000 },
  { label: 'Checking correctness', duration: 3000 },
  { label: 'Reviewing performance', duration: 3000 },
  { label: 'Scanning for security issues', duration: 2500 },
  { label: 'Generating recommendations', duration: 2500 },
];

export function LoadingSteps() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (activeStep < STEPS.length - 1) {
      timeout = setTimeout(() => setActiveStep((s) => s + 1), STEPS[activeStep].duration);
    }
    return () => clearTimeout(timeout);
  }, [activeStep]);

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-xs space-y-3">
        <div className="flex items-center justify-center mb-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
        {STEPS.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-colors duration-300 ${
                i < activeStep
                  ? 'bg-primary/20 text-primary'
                  : i === activeStep
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {i < activeStep ? '✓' : i + 1}
            </div>
            <span
              className={`text-xs transition-colors duration-300 ${
                i <= activeStep ? 'text-foreground font-medium' : 'text-muted-foreground'
              }`}
            >
              {step.label}
            </span>
            {i === activeStep && <Loader2 className="ml-auto h-3 w-3 animate-spin text-primary" />}
          </div>
        ))}
      </div>
    </div>
  );
}
