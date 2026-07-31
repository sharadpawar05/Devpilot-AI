# DevPilot

An AI-powered SaaS platform for engineering management automation.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Backend:** Fastify, TypeScript
- **Monorepo:** pnpm, Turborepo

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+

### Installation

```bash
git clone https://github.com/your-org/devpilot.git
cd devpilot
pnpm install
```

### Development

```bash
pnpm dev          # Start all dev servers
pnpm build        # Build all packages
pnpm lint         # Lint all packages
pnpm typecheck    # Type check all packages
```

## Project Structure

```
devpilot/
├── apps/
│   ├── web/              # Frontend React application
│   └── api/              # Backend Fastify API
├── packages/
│   ├── ai-core/          # Core AI orchestration
│   ├── ai-providers/     # AI provider abstractions
│   ├── ai-prompts/       # AI prompt templates
│   ├── ui/               # Shared UI components
│   ├── config/           # Shared configuration
│   ├── shared/           # Shared business logic
│   ├── types/            # Shared TypeScript types
│   └── utils/            # Shared utility functions
├── docs/
├── docker/
├── scripts/
└── .github/
```

## License

MIT
