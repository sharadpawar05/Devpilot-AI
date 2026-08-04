export type TechCategory =
  | 'architecture'
  | 'frontend'
  | 'backend'
  | 'database'
  | 'orm'
  | 'styling'
  | 'testing'
  | 'linting'
  | 'ai'
  | 'authentication'
  | 'deployment'
  | 'package-manager'
  | 'build-tool'
  | 'runtime';

export interface DetectedTech {
  name: string;
  version?: string;
  confidence: number;
  source: string;
}

export interface TechnologyStack {
  architecture?: DetectedTech[];
  frontend?: DetectedTech[];
  backend?: DetectedTech[];
  database?: DetectedTech[];
  orm?: DetectedTech[];
  styling?: DetectedTech[];
  testing?: DetectedTech[];
  linting?: DetectedTech[];
  ai?: DetectedTech[];
  authentication?: DetectedTech[];
  deployment?: DetectedTech[];
  packageManager?: DetectedTech[];
  buildTool?: DetectedTech[];
  runtime?: DetectedTech[];
}

export const CATEGORY_META: Record<
  TechCategory,
  { label: string; icon: string; color: string; bgColor: string; textColor: string }
> = {
  architecture: {
    label: 'Architecture',
    icon: 'Layout',
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-50 dark:bg-violet-950/30',
    textColor: 'text-violet-700 dark:text-violet-300',
  },
  frontend: {
    label: 'Frontend',
    icon: 'Monitor',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    textColor: 'text-blue-700 dark:text-blue-300',
  },
  backend: {
    label: 'Backend',
    icon: 'Server',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    textColor: 'text-emerald-700 dark:text-emerald-300',
  },
  database: {
    label: 'Database',
    icon: 'Database',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    textColor: 'text-amber-700 dark:text-amber-300',
  },
  orm: {
    label: 'ORM',
    icon: 'Link',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    textColor: 'text-orange-700 dark:text-orange-300',
  },
  styling: {
    label: 'Styling',
    icon: 'Palette',
    color: 'text-pink-600 dark:text-pink-400',
    bgColor: 'bg-pink-50 dark:bg-pink-950/30',
    textColor: 'text-pink-700 dark:text-pink-300',
  },
  testing: {
    label: 'Testing',
    icon: 'FlaskConical',
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-50 dark:bg-teal-950/30',
    textColor: 'text-teal-700 dark:text-teal-300',
  },
  linting: {
    label: 'Linting',
    icon: 'CheckCircle',
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-50 dark:bg-cyan-950/30',
    textColor: 'text-cyan-700 dark:text-cyan-300',
  },
  ai: {
    label: 'AI',
    icon: 'Brain',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    textColor: 'text-purple-700 dark:text-purple-300',
  },
  authentication: {
    label: 'Auth',
    icon: 'Shield',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    textColor: 'text-red-700 dark:text-red-300',
  },
  deployment: {
    label: 'Deployment',
    icon: 'Rocket',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
    textColor: 'text-indigo-700 dark:text-indigo-300',
  },
  'package-manager': {
    label: 'Package Manager',
    icon: 'Package',
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-950/30',
    textColor: 'text-slate-700 dark:text-slate-300',
  },
  'build-tool': {
    label: 'Build Tool',
    icon: 'Wrench',
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    textColor: 'text-yellow-700 dark:text-yellow-300',
  },
  runtime: {
    label: 'Runtime',
    icon: 'Zap',
    color: 'text-lime-600 dark:text-lime-400',
    bgColor: 'bg-lime-50 dark:bg-lime-950/30',
    textColor: 'text-lime-700 dark:text-lime-300',
  },
};

export const CATEGORY_ORDER: TechCategory[] = [
  'architecture',
  'runtime',
  'frontend',
  'backend',
  'database',
  'orm',
  'styling',
  'testing',
  'linting',
  'ai',
  'authentication',
  'deployment',
  'package-manager',
  'build-tool',
];

// Map category keys to TechnologyStack property names
export const STACK_KEY_MAP: Record<TechCategory, keyof TechnologyStack> = {
  architecture: 'architecture',
  frontend: 'frontend',
  backend: 'backend',
  database: 'database',
  orm: 'orm',
  styling: 'styling',
  testing: 'testing',
  linting: 'linting',
  ai: 'ai',
  authentication: 'authentication',
  deployment: 'deployment',
  'package-manager': 'packageManager',
  'build-tool': 'buildTool',
  runtime: 'runtime',
};

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 95) return 'text-emerald-600 dark:text-emerald-400';
  if (confidence >= 85) return 'text-amber-600 dark:text-amber-400';
  return 'text-muted-foreground';
}
