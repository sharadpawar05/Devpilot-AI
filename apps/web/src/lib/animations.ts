import { cn } from '@/lib/utils';

const transitionClasses = {
  fast: 'transition-all duration-150 ease-out',
  normal: 'transition-all duration-200 ease-out',
  slow: 'transition-all duration-300 ease-out',
  spring: 'transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
} as const;

const hoverClasses = {
  subtle: 'hover:bg-muted/50',
  lift: 'hover:shadow-md hover:-translate-y-0.5',
  scale: 'hover:scale-[1.02]',
  glow: 'hover:shadow-lg hover:shadow-primary/10',
  none: '',
} as const;

const focusClasses = {
  default:
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  minimal: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  none: '',
} as const;

const skeletonShimmer = 'animate-pulse bg-muted rounded';

const streamingCursor = 'animate-[pulse_1s_ease-in-out_infinite]';

const fadeIn = 'animate-[fadeIn_200ms_ease-out]';
const slideUp = 'animate-[slideUp_200ms_ease-out]';
const slideDown = 'animate-[slideDown_200ms_ease-out]';

const animationKeyframes = `
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

function getAnimationStyles(): string {
  if (typeof document === 'undefined') return '';
  const id = 'devpilot-animations';
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = animationKeyframes;
    document.head.appendChild(style);
  }
  return '';
}

function cnWithAnimation(...inputs: (string | undefined | null | false)[]): string {
  return cn(...inputs);
}

export {
  transitionClasses,
  hoverClasses,
  focusClasses,
  skeletonShimmer,
  streamingCursor,
  fadeIn,
  slideUp,
  slideDown,
  getAnimationStyles,
  cnWithAnimation,
};
