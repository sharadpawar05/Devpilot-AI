# Repository Intelligence — Architecture Design Document

**Author:** Principal Software Architect
**Date:** 2026-08-04
**Status:** Draft
**Feature Branch:** `feature/repository-intelligence`

---

## Table of Contents

1. [Overall Feature Architecture](#1-overall-feature-architecture)
2. [Frontend Component Hierarchy](#2-frontend-component-hierarchy)
3. [Backend Services](#3-backend-services)
4. [Database Schema Changes](#4-database-schema-changes)
5. [Repository Indexing Workflow](#5-repository-indexing-workflow)
6. [GitHub API Integration Strategy](#6-github-api-integration-strategy)
7. [Embedding and Vector Search Strategy](#7-embedding-and-vector-search-strategy)
8. [AI Context-Building Pipeline](#8-ai-context-building-pipeline)
9. [Scalability Considerations](#9-scalability-considerations)
10. [Security Considerations](#10-security-considerations)
11. [Sequence Diagram](#11-sequence-diagram)
12. [REST API Contracts](#12-rest-api-contracts)
13. [Folder Structure](#13-folder-structure)
14. [UI Wireframes](#14-ui-wireframes)
15. [Incremental Implementation Plan](#15-incremental-implementation-plan)

---

## 1. Overall Feature Architecture

### 1.1 Vision

Repository Intelligence transforms DevPilot from a code-generation tool into a **deep code understanding platform**. It provides four pillars of capability:

| Pillar                    | Description                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| **Repository Overview**   | High-level health, architecture map, language breakdown, dependency graph                |
| **Architecture Explorer** | Interactive module/dependency visualization, component hierarchy, data flow              |
| **Repository Search**     | Semantic code search across indexed repositories using vector embeddings                 |
| **Health Dashboard**      | Code quality metrics, technical debt indicators, security vulnerabilities, test coverage |

### 1.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React 19)                        │
│  ┌──────────┐ ┌──────────────┐ ┌──────────────┐ ┌───────────────┐  │
│  │ Repo     │ │ Architecture │ │ Repository   │ │ Health        │  │
│  │ Overview │ │ Explorer     │ │ Search       │ │ Dashboard     │  │
│  └────┬─────┘ └──────┬───────┘ └──────┬───────┘ └───────┬───────┘  │
│       │              │                │                 │           │
│  ┌────┴──────────────┴────────────────┴─────────────────┴────────┐  │
│  │                    Repository Intelligence Provider            │  │
│  └───────────────────────────┬───────────────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────────┘
                               │ REST API + SSE
┌──────────────────────────────┼──────────────────────────────────────┐
│                         BACKEND (Fastify)                           │
│  ┌───────────────────────────┴───────────────────────────────────┐  │
│  │                    API Route Layer (/api/v1/repo-intel)       │  │
│  └───┬──────────┬──────────────┬─────────────┬──────────────────┘  │
│      │          │              │             │                     │
│  ┌───┴───┐ ┌────┴────┐ ┌──────┴─────┐ ┌─────┴──────┐             │
│  │Index  │ │Search   │ │Health      │ │Architecture│             │
│  │Service│ │Service  │ │Analyzer    │ │Analyzer    │             │
│  └───┬───┘ └────┬────┘ └──────┬─────┘ └─────┬──────┘             │
│      │          │             │             │                     │
│  ┌───┴──────────┴─────────────┴─────────────┴──────────────────┐  │
│  │              Shared: GitHub Client, DB, AI Gateway           │  │
│  └─────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────┐
│                    DATA & INTEGRATION LAYER                         │
│  ┌──────────────┐ ┌──────────┴───┐ ┌──────────────┐ ┌──────────┐  │
│  │ PostgreSQL   │ │ pgvector     │ │ GitHub API   │ │ AI       │  │
│  │ (Supabase)   │ │ (Extension)  │ │ (Octokit)    │ │ Gateway  │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### 1.3 Design Principles

1. **Incremental Enhancement** — Extends existing `repository_indexes` table and `repository-chat` feature; does not break current behavior
2. **Lazy Indexing** — Repositories are indexed on-demand, not proactively; index is invalidated on new pushes
3. **pgvector-first** — Uses PostgreSQL with pgvector extension (already on Supabase) instead of a separate vector DB, minimizing operational overhead
4. **Progressive Enhancement** — Works without embeddings (keyword-based); embeddings enhance quality but are not required
5. **Streaming-First** — All AI-powered responses use SSE streaming for responsive UX

### 1.4 Key Technology Decisions

| Decision         | Choice                               | Rationale                                                  |
| ---------------- | ------------------------------------ | ---------------------------------------------------------- |
| Vector Database  | pgvector (Supabase)                  | No new infrastructure; already using Supabase PostgreSQL   |
| Embedding Model  | Gemini `text-embedding-004` (768d)   | Already using Gemini; free tier is generous                |
| AST Parsing      | TypeScript Compiler API + regex      | No extra deps needed; existing regex-based parser enhanced |
| Dependency Graph | Static analysis of imports/exports   | No runtime instrumentation needed                          |
| Health Metrics   | AI-assisted analysis + static checks | Leverages existing AI gateway                              |

---

## 2. Frontend Component Hierarchy

### 2.1 Page Structure

```
/src/pages/
├── repository-intelligence/
│   ├── index.tsx                    # Main RI page with tab navigation
│   ├── overview/
│   │   ├── index.tsx                # Repository Overview page
│   │   ├── repo-stats-card.tsx      # File count, size, languages
│   │   ├── architecture-preview.tsx # Mini architecture graph
│   │   ├── recent-activity.tsx      # Recent commits/PRs from GitHub
│   │   └── health-summary.tsx       # Quick health score + badges
│   ├── explorer/
│   │   ├── index.tsx                # Architecture Explorer page
│   │   ├── dependency-graph.tsx     # Interactive force-directed graph
│   │   ├── module-tree.tsx          # Hierarchical module view
│   │   ├── data-flow.tsx            # Data flow visualization
│   │   └── file-detail-panel.tsx    # Side panel with file details
│   ├── search/
│   │   ├── index.tsx                # Repository Search page
│   │   ├── search-bar.tsx           # Search input with filters
│   │   ├── search-results.tsx       # Ranked results list
│   │   └── result-preview.tsx       # Code preview with highlights
│   └── health/
│       ├── index.tsx                # Health Dashboard page
│       ├── health-score-ring.tsx    # Overall score visualization
│       ├── metrics-grid.tsx         # Quality/security/maintainability cards
│       ├── tech-debt-list.tsx       # Technical debt items
│       └── recommendations.tsx      # AI-generated recommendations
```

### 2.2 Component Tree

```
<RepositoryIntelligencePage>
├── <RepositorySelector />           # Select repo + branch
├── <IndexingStatusBanner />         # Shows indexing progress
├── <Tabs>                           # Overview | Explorer | Search | Health
│   ├── <Tab id="overview">
│   │   ├── <RepoStatsCard />
│   │   ├── <LanguageBreakdownChart />
│   │   ├── <ArchitecturePreview />
│   │   ├── <RecentActivity />
│   │   └── <HealthSummary />
│   ├── <Tab id="explorer">
│   │   ├── <ModuleTree />
│   │   ├── <DependencyGraph />
│   │   ├── <DataFlowDiagram />
│   │   └── <FileDetailPanel />
│   ├── <Tab id="search">
│   │   ├── <SearchBar />
│   │   ├── <SearchFilters />
│   │   ├── <SearchResults />
│   │   └── <ResultPreview />
│   └── <Tab id="health">
│       ├── <HealthScoreRing />
│       ├── <MetricsGrid />
│       ├── <TechDebtList />
│       └── <Recommendations />
└── <StickyFooter />                 # Reuses workspace component
```

### 2.3 Shared Component Reuse

| New RI Component      | Reused From               | Rationale                   |
| --------------------- | ------------------------- | --------------------------- |
| `RepositorySelector`  | New (wraps `Select`)      | Needs repo+branch combo     |
| `IndexingStatusBadge` | `MetadataBadges`          | Consistent badge styling    |
| `FileCard`            | `SectionCard`             | Expandable card pattern     |
| `HealthMetricCard`    | `Card` (UI primitive)     | Metric display              |
| `SearchResultCard`    | `SectionCard`             | Consistent card pattern     |
| `EmptyState`          | `shared/EmptyState`       | Reuse directly              |
| `LoadingSteps`        | `shared/LoadingSteps`     | Multi-step indexing display |
| `ErrorAlert`          | `shared/ErrorAlert`       | Reuse directly              |
| `MarkdownRenderer`    | `shared/MarkdownRenderer` | AI response rendering       |

---

## 3. Backend Services

### 3.1 Service Architecture

```
/apps/api/src/features/repo-intelligence/
├── index.ts                         # Route registration
├── routes/
│   ├── overview-routes.ts           # GET /repo-intel/overview
│   ├── explorer-routes.ts           # GET /repo-intel/explorer
│   ├── search-routes.ts             # POST /repo-intel/search
│   └── health-routes.ts             # GET /repo-intel/health
├── services/
│   ├── indexing-service.ts           # Enhanced indexer (extends repository-chat)
│   ├── search-service.ts            # Vector + keyword hybrid search
│   ├── overview-service.ts          # Repository overview aggregation
│   ├── explorer-service.ts          # Architecture/dependency analysis
│   ├── health-analyzer.ts           # Code health metrics
│   ├── embedding-service.ts         # Embedding generation + storage
│   └── dependency-analyzer.ts       # Import/export graph analysis
├── analyzers/
│   ├── ast-analyzer.ts              # TypeScript/JS AST parsing
│   ├── complexity-analyzer.ts       # Cyclomatic complexity
│   ├── test-analyzer.ts             # Test coverage estimation
│   └── security-analyzer.ts         # Basic security pattern detection
├── types.ts                         # RI-specific types
└── utils/
    ├── graph.ts                     # Graph data structure utilities
    └── scoring.ts                   # Health score computation
```

### 3.2 Service Descriptions

#### IndexingService (Enhanced)

Extends the existing `RepositoryIndexer` from `repository-chat`. Adds:

- **AST-based analysis** — Parses imports/exports to build dependency graph
- **Embedding generation** — Generates vector embeddings for code chunks
- **Chunk storage** — Stores code chunks + embeddings in `repo_code_chunks`
- **Incremental updates** — Only re-indexes changed files on reindex

```typescript
interface EnhancedIndexResult extends RepoIndexData {
  dependencyGraph: DependencyGraph;
  codeChunks: CodeChunk[];
  embeddingsGenerated: number;
}
```

#### SearchService

Hybrid search combining vector similarity and keyword matching:

```typescript
interface SearchService {
  search(userId: string, query: string, opts: SearchOptions): Promise<SearchResult[]>;
}

interface SearchOptions {
  owner: string;
  repo: string;
  branch?: string;
  fileFilter?: string;
  languageFilter?: string;
  limit?: number;
  threshold?: number; // similarity threshold, default 0.7
}

interface SearchResult {
  filePath: string;
  fileName: string;
  language: string;
  score: number; // combined relevance score
  snippet: string; // highlighted matching code
  startLine: number;
  endLine: number;
  matchType: 'semantic' | 'keyword' | 'hybrid';
}
```

#### OverviewService

Aggregates data for the repository overview tab:

```typescript
interface OverviewService {
  getOverview(userId: string, owner: string, repo: string, branch: string): Promise<RepoOverview>;
}

interface RepoOverview {
  stats: RepoStats;
  languageBreakdown: RepoLanguageBreakdown;
  architecture: ArchitectureSummary;
  healthScore: number;
  recentCommits: GitHubCommit[];
  recentPRs: GitHubPR[];
  keyFiles: KeyFileInfo[];
}
```

#### ExplorerService

Provides architecture exploration data:

```typescript
interface ExplorerService {
  getArchitecture(
    userId: string,
    owner: string,
    repo: string,
    branch: string,
  ): Promise<ArchitectureData>;
}

interface ArchitectureData {
  modules: Module[];
  dependencies: Dependency[];
  entryPoints: string[];
  circularDependencies: string[][];
  moduleClusters: ModuleCluster[];
}

interface Module {
  id: string;
  path: string;
  name: string;
  type: 'component' | 'hook' | 'util' | 'service' | 'config' | 'page' | 'other';
  fileCount: number;
  totalSize: number;
  imports: string[];
  exports: string[];
}
```

#### HealthAnalyzer

Computes code health metrics:

```typescript
interface HealthAnalyzer {
  analyze(userId: string, owner: string, repo: string, branch: string): Promise<HealthReport>;
}

interface HealthReport {
  overallScore: number; // 0-100
  metrics: HealthMetric[];
  techDebt: TechDebtItem[];
  recommendations: Recommendation[];
  securityAlerts: SecurityAlert[];
}

interface HealthMetric {
  category: 'quality' | 'security' | 'maintainability' | 'testing' | 'performance';
  name: string;
  score: number; // 0-100
  description: string;
  details?: string;
}
```

#### EmbeddingService

Manages embedding generation and vector operations:

```typescript
interface EmbeddingService {
  generateEmbeddings(chunks: CodeChunk[]): Promise<Embedding[]>;
  findSimilar(query: string, opts: SimilarityOptions): Promise<SimilarResult[]>;
  deleteEmbeddings(userId: string, owner: string, repo: string): Promise<void>;
}

interface CodeChunk {
  id: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  language: string;
  chunkType: 'function' | 'class' | 'module' | 'comment' | 'raw';
}
```

---

## 4. Database Schema Changes

### 4.1 New Enum Values

```prisma
// Add to existing RepoIndexStatus enum
enum RepoIndexStatus {
  NOT_INDEXED
  INDEXING
  INDEXING_AST      // NEW: AST analysis phase
  INDEXING_EMBEDDINGS  // NEW: Embedding generation phase
  READY
  FAILED
  OUTDATED
}

// New enum for code chunk types
enum CodeChunkType {
  FUNCTION
  CLASS
  MODULE
  COMMENT
  RAW
  COMPONENT
  HOOK
  TYPE
  INTERFACE
}
```

### 4.2 New Tables

```prisma
// ─── Code Chunks (stores individual code units for search) ──────────
model RepoCodeChunk {
  id           String        @id @default(uuid()) @db.Uuid
  repositoryId String        @db.Uuid
  filePath     String
  content      String        @db.Text
  startLine    Int
  endLine      Int
  language     String
  chunkType    CodeChunkType
  name         String?       // function/class name
  imports      String[]      // extracted imports
  exports      String[]      // extracted exports
  tokenCount   Int           @default(0)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  repository RepositoryIndex @relation(fields: [repositoryId], references: [id], onDelete: Cascade)
  embedding  RepoEmbedding?

  @@index([repositoryId, filePath])
  @@index([repositoryId, chunkType])
  @@map("repo_code_chunks")
}

// ─── Vector Embeddings (pgvector) ──────────────────────────────────
model RepoEmbedding {
  id        String   @id @default(uuid()) @db.Uuid
  chunkId   String   @unique @db.Uuid
  embedding Unsupported("vector(768)")  // Gemini text-embedding-004 = 768 dimensions
  model     String   @default("text-embedding-004")
  createdAt DateTime @default(now())

  chunk RepoCodeChunk @relation(fields: [chunkId], references: [id], onDelete: Cascade)

  @@index([chunkId])
  @@map("repo_embeddings")
}

// ─── Dependency Graph (stores import/export relationships) ──────────
model RepoDependency {
  id             String   @id @default(uuid()) @db.Uuid
  repositoryId   String   @db.Uuid
  sourceFile     String
  targetFile     String
  importType     String   // 'default' | 'named' | 'namespace' | 'side-effect'
  importNames    String[] // ['ComponentA', 'useHook'] etc.
  isExternal     Boolean  @default(false) // true if target is node_modules
  createdAt      DateTime @default(now())

  repository RepositoryIndex @relation(fields: [repositoryId], references: [id], onDelete: Cascade)

  @@unique([repositoryId, sourceFile, targetFile])
  @@index([repositoryId, sourceFile])
  @@index([repositoryId, targetFile])
  @@map("repo_dependencies")
}

// ─── Health Snapshots (stores historical health metrics) ────────────
model RepoHealthSnapshot {
  id             String   @id @default(uuid()) @db.Uuid
  repositoryId   String   @db.Uuid
  commitSha      String
  overallScore   Int      // 0-100
  metrics        Json     // HealthMetric[]
  techDebt       Json     // TechDebtItem[]
  recommendations Json    // Recommendation[]
  securityAlerts Json     // SecurityAlert[]
  analyzedAt     DateTime @default(now())

  repository RepositoryIndex @relation(fields: [repositoryId], references: [id], onDelete: Cascade)

  @@index([repositoryId, analyzedAt(sort: Desc)])
  @@map("repo_health_snapshots")
}
```

### 4.3 Modified Tables

```prisma
// Extend RepositoryIndex with new fields
model RepositoryIndex {
  // ... existing fields ...

  // NEW fields
  totalChunks      Int       @default(0)
  totalEmbeddings  Int       @default(0)
  astIndexedAt     DateTime?
  lastHealthCheck  DateTime?

  // NEW relations
  codeChunks       RepoCodeChunk[]
  dependencies     RepoDependency[]
  healthSnapshots  RepoHealthSnapshot[]
}
```

### 4.4 Migration Strategy

1. **Phase 1:** Enable `pgvector` extension on Supabase
2. **Phase 2:** Add new enums and tables (non-breaking)
3. **Phase 3:** Add new columns to `repository_indexes` (nullable, non-breaking)
4. **Phase 4:** Backfill existing indexes with dependency data (background job)

---

## 5. Repository Indexing Workflow

### 5.1 Enhanced Indexing Pipeline

The existing indexer fetches file tree + key file contents. The enhanced pipeline adds:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENHANCED INDEXING PIPELINE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase 1: Tree Fetch (existing)                                 │
│  ┌──────────┐    ┌──────────────┐    ┌────────────────────┐    │
│  │ GitHub   │───>│ Filter       │───>│ Build File Tree    │    │
│  │ Git Tree │    │ Supported    │    │ + File Metadata    │    │
│  └──────────┘    │ Files        │    └────────────────────┘    │
│                  └──────────────┘                               │
│                                                                 │
│  Phase 2: Content Fetch (existing, enhanced)                    │
│  ┌──────────┐    ┌──────────────┐    ┌────────────────────┐    │
│  │ Fetch    │───>│ Parse        │───>│ Extract            │    │
│  │ Key File │    │ Imports/     │    │ Dependencies       │    │
│  │ Contents │    │ Exports      │    │                    │    │
│  └──────────┘    └──────────────┘    └────────────────────┘    │
│                                                                 │
│  Phase 3: AST Analysis (NEW)                                    │
│  ┌──────────┐    ┌──────────────┐    ┌────────────────────┐    │
│  │ Parse    │───>│ Build        │───>│ Compute            │    │
│  │ All .ts/ │    │ Dependency   │    │ Module Clusters    │    │
│  │ .tsx     │    │ Graph        │    │ + Entry Points     │    │
│  └──────────┘    └──────────────┘    └────────────────────┘    │
│                                                                 │
│  Phase 4: Code Chunking (NEW)                                   │
│  ┌──────────┐    ┌──────────────┐    ┌────────────────────┐    │
│  │ Split    │───>│ Classify     │───>│ Store Chunks       │    │
│  │ Files    │    │ Chunks       │    │ in repo_code_chunks│    │
│  │ into     │    │ (func/class/ │    │                    │    │
│  │ Chunks   │    │  module)     │    │                    │    │
│  └──────────┘    └──────────────┘    └────────────────────┘    │
│                                                                 │
│  Phase 5: Embedding Generation (NEW, optional)                  │
│  ┌──────────┐    ┌──────────────┐    ┌────────────────────┐    │
│  │ Batch    │───>│ Generate     │───> │ Store Vectors      │    │
│  │ Chunks   │    │ Embeddings   │    │ in repo_embeddings │    │
│  │ (50/batch│    │ via Gemini   │    │ (pgvector)         │    │
│  └──────────┘    └──────────────┘    └────────────────────┘    │
│                                                                 │
│  Phase 6: Finalization (existing)                               │
│  ┌──────────┐    ┌──────────────┐    ┌────────────────────┐    │
│  │ Compute  │───>│ Save to      │───>│ Mark Status: READY │    │
│  │ Stats    │    │ Cache (DB)   │    │                    │    │
│  └──────────┘    └──────────────┘    └────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Chunking Strategy

Code is split into semantically meaningful chunks:

| Chunk Type  | Splitting Rule                 | Max Size  |
| ----------- | ------------------------------ | --------- |
| `function`  | Each exported/named function   | 200 lines |
| `class`     | Each class with its methods    | 300 lines |
| `component` | Each React component           | 200 lines |
| `hook`      | Each custom hook               | 150 lines |
| `module`    | File-level (imports + exports) | 100 lines |
| `type`      | Type/interface definitions     | 100 lines |
| `comment`   | JSDoc/block comments           | 50 lines  |
| `raw`       | Fallback for unmatched code    | 100 lines |

Chunks overlap by 20 lines to maintain context across boundaries.

### 5.3 Indexing Status Tracking

```
NOT_INDEXED
    │
    ▼
INDEXING (Phase 1-2: tree + content fetch)
    │
    ▼
INDEXING_AST (Phase 3: AST analysis)
    │
    ▼
INDEXING_EMBEDDINGS (Phase 4-5: chunking + embedding)
    │
    ▼
READY
```

The frontend polls `GET /repo-intel/status` every 2 seconds during indexing to show progress.

---

## 6. GitHub API Integration Strategy

### 6.1 API Usage Budget

| Operation        | Endpoint                                       | Rate Limit | Frequency                        |
| ---------------- | ---------------------------------------------- | ---------- | -------------------------------- |
| Get tree         | `GET /repos/{owner}/{repo}/git/trees/{branch}` | 5000/hr    | On index                         |
| Get file content | `GET /repos/{owner}/{repo}/contents/{path}`    | 5000/hr    | On index (key files) + on-demand |
| Get commits      | `GET /repos/{owner}/{repo}/commits`            | 5000/hr    | On overview load                 |
| Get PRs          | `GET /repos/{owner}/{repo}/pulls`              | 5000/hr    | On overview load                 |
| Get file blame   | `GET /repos/{owner}/{repo}/blame/{path}`       | 5000/hr    | On-demand only                   |

### 6.2 Token Management

Reuses the existing encrypted token system (`core/github/token.ts` + `core/github/crypto.ts`):

```typescript
// Existing pattern - reuse directly
const octokit = await getOctokit(userId);
```

### 6.3 Rate Limit Handling

```typescript
// New utility: github-rate-limiter.ts
class GitHubRateLimiter {
  private remaining: number = 5000;
  private resetAt: Date = new Date();

  async checkRateLimit(octokit: Octokit): Promise<void> {
    const { data } = await octokit.rest.rateLimit.get();
    this.remaining = data.resources.core.remaining;
    this.resetAt = new Date(data.resources.core.reset * 1000);
  }

  get waitTimeMs(): number {
    if (this.remaining > 100) return 0;
    return Math.max(0, this.resetAt.getTime() - Date.now()) + 1000;
  }
}
```

### 6.4 Webhook Integration (Future)

For real-time index invalidation:

```yaml
# Future: GitHub webhook endpoint
POST /api/v1/repo-intel/webhook
  X-GitHub-Event: push
  → Compare commit SHA with stored index SHA
  → If mismatch, mark index as OUTDATED
```

### 6.5 File Content Caching

To minimize GitHub API calls during AI queries:

```
Request file content from GitHub
    │
    ├─> Check if file already in code_chunks table (by SHA)
    │   └─> If SHA matches, use cached content
    │
    └─> If not cached, fetch from GitHub API
        └─> Store in code_chunks for future use
```

---

## 7. Embedding and Vector Search Strategy

### 7.1 Embedding Model Selection

| Model                           | Dimensions | Max Tokens | Cost                 | Quality |
| ------------------------------- | ---------- | ---------- | -------------------- | ------- |
| Gemini `text-embedding-004`     | 768        | 2048       | Free (1M tokens/day) | High    |
| OpenAI `text-embedding-3-small` | 1536       | 8191       | $0.02/1M tokens      | High    |

**Decision:** Use Gemini `text-embedding-004` as primary since we already integrate with Gemini. OpenAI as fallback.

### 7.2 Embedding Pipeline

```
Code Chunk (max 2048 tokens)
    │
    ▼
┌──────────────────────────┐
│ Preprocessing:           │
│ - Remove leading spaces  │
│ - Add chunk metadata     │
│   (file, type, name)     │
│ - Truncate to 2048 tokens│
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Gemini Embedding API     │
│ text-embedding-004       │
│ → 768-dimension vector   │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Normalize vector         │
│ L2 norm = 1.0            │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Store in pgvector        │
│ repo_embeddings table    │
└──────────────────────────┘
```

### 7.3 Vector Search Query

```sql
-- Semantic search using cosine distance
SELECT
  c.id,
  c.file_path,
  c.content,
  c.start_line,
  c.end_line,
  c.language,
  c.chunk_type,
  c.name,
  1 - (e.embedding <=> $query_embedding) AS similarity
FROM repo_code_chunks c
JOIN repo_embeddings e ON e.chunk_id = c.id
JOIN repository_indexes ri ON ri.id = c.repository_id
WHERE ri.user_id = $user_id
  AND ri.owner = $owner
  AND ri.repo = $repo
  AND ri.branch = $branch
  AND ri.status = 'READY'
  AND 1 - (e.embedding <=> $query_embedding) > $threshold
ORDER BY e.embedding <=> $query_embedding
LIMIT $limit;
```

### 7.4 Hybrid Search Strategy

Combine vector similarity with keyword matching for best results:

```
Query: "authentication middleware"
    │
    ├─> Vector Search (cosine similarity > 0.7)
    │   → Returns semantically similar code
    │
    ├─> Keyword Search (fuzzy match on content)
    │   → Returns exact text matches
    │
    └─> Combine & Rank:
        final_score = (0.6 * vector_score) + (0.4 * keyword_score)
        Deduplicate by file path
        Return top 20 results
```

### 7.5 Embedding Cost Estimation

| Repository Size          | Chunks  | Embedding Cost       | Storage  |
| ------------------------ | ------- | -------------------- | -------- |
| Small (<100 files)       | ~500    | Free tier            | ~5 MB    |
| Medium (100-1000 files)  | ~5000   | Free tier            | ~50 MB   |
| Large (1000-5000 files)  | ~25000  | Free tier            | ~250 MB  |
| Very Large (5000+ files) | ~50000+ | May exceed free tier | ~500 MB+ |

---

## 8. AI Context-Building Pipeline

### 8.1 Context Assembly for Repository Intelligence Queries

When a user asks a question about a repository, the AI needs structured context:

```
┌─────────────────────────────────────────────────────────────┐
│                    AI CONTEXT PIPELINE                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Query Analysis                                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ - Classify intent: overview / architecture / search  │   │
│  │ - Extract entities: file names, function names, etc. │   │
│  │ - Determine scope: specific file vs whole repo       │   │
│  └──────────────────────────┬───────────────────────────┘   │
│                             │                               │
│  2. Context Gathering                                       │
│  ┌──────────────────────────┴───────────────────────────┐   │
│  │                                                      │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │   │
│  │  │ Repository  │  │ Relevant     │  │ Dependency │  │   │
│  │  │ Metadata    │  │ Code Chunks  │  │ Graph      │  │   │
│  │  │ (stats,     │  │ (semantic    │  │ (import    │  │   │
│  │  │  languages, │  │  search      │  │  chains)   │  │   │
│  │  │  structure) │  │  results)    │  │            │  │   │
│  │  └─────────────┘  └──────────────┘  └────────────┘  │   │
│  │                                                      │   │
│  └──────────────────────────┬───────────────────────────┘   │
│                             │                               │
│  3. Context Formatting                                     │
│  ┌──────────────────────────┴───────────────────────────┐   │
│  │                                                      │   │
│  │  System Prompt: "You are a code intelligence expert  │   │
│  │  analyzing repository {owner}/{repo}..."             │   │
│  │                                                      │   │
│  │  Context Block 1: Repository Overview                │   │
│  │  - Stats, languages, key files                       │   │
│  │                                                      │   │
│  │  Context Block 2: Relevant Code                      │   │
│  │  - Top 10 semantically similar code chunks           │   │
│  │  - Each with file path, lines, and content           │   │
│  │                                                      │   │
│  │  Context Block 3: Dependency Context                 │   │
│  │  - Files that import/imported by relevant files      │   │
│  │  - Module cluster information                        │   │
│  │                                                      │   │
│  │  Context Block 4: Conversation History               │   │
│  │  - Previous messages in session                      │   │
│  │                                                      │   │
│  └──────────────────────────┬───────────────────────────┘   │
│                             │                               │
│  4. AI Generation                                         │
│  ┌──────────────────────────┴───────────────────────────┐   │
│  │ - Use workflow engine (existing)                     │   │
│  │ - Workflow type: REPOSITORY_INTELLIGENCE (new)       │   │
│  │ - Stream response via SSE                            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Prompt Template

```markdown
---
id: repository-intelligence
version: 1.0.0
category: repository
tags: [repository, intelligence, architecture, search]
---

# Repository Intelligence

You are a code intelligence expert analyzing the repository **{{owner}}/{{repo}}**.

## Repository Overview

- **Total Files:** {{totalFiles}}
- **Languages:** {{languageBreakdown}}
- **Architecture:** {{architectureSummary}}

## Repository Structure
```

{{treeSummary}}

````

## Relevant Code
{{#each relevantChunks}}
### {{this.filePath}} (lines {{this.startLine}}-{{this.endLine}})
```{{this.language}}
{{this.content}}
````

{{/each}}

## Dependency Context

{{#if dependencyContext}}
Files related to the query through import/export chains:
{{dependencyContext}}
{{/if}}

## Instructions

1. Analyze the provided code context carefully
2. Reference specific files and line numbers
3. Explain code relationships and dependencies
4. Provide actionable insights
5. When unsure, state limitations clearly

## User Question

{{question}}

````

### 8.3 Context Size Management

| Context Block | Max Tokens | Strategy |
|---------------|-----------|----------|
| System prompt | 500 | Fixed template |
| Repository overview | 1000 | Always included |
| Relevant code chunks | 6000 | Top-N by relevance, truncated |
| Dependency context | 1500 | Only direct dependencies |
| Conversation history | 2000 | Last 4 messages |
| **Total max** | **~11000** | Fits within model context |

---

## 9. Scalability Considerations

### 9.1 Large Repository Handling

| Repo Size | Files | Strategy |
|-----------|-------|----------|
| Small | <100 | Full index, all chunks embedded |
| Medium | 100-1000 | Full index, all chunks embedded |
| Large | 1000-5000 | Full index, only key chunks embedded (components, hooks, utils) |
| Very Large | 5000+ | Partial index (configurable depth), smart chunk selection |

### 9.2 Indexing Throttling

```typescript
// Per-user rate limiting for indexing
const INDEXING_LIMITS = {
  concurrent: 2,           // max 2 repos indexing simultaneously
  perHour: 10,             // max 10 index operations per hour
  perDay: 50,              // max 50 index operations per day
  cooldownMs: 30_000,      // 30s between index starts
};
````

### 9.3 Embedding Batch Processing

```typescript
// Batch embeddings to stay within API limits
const EMBEDDING_CONFIG = {
  batchSize: 50, // 50 chunks per API call
  maxConcurrent: 3, // 3 concurrent embedding requests
  retryDelayMs: 1000, // 1s retry delay
  maxRetries: 3,
};
```

### 9.4 Database Optimization

```sql
-- Indexes for performance
CREATE INDEX idx_repo_chunks_path ON repo_code_chunks(repository_id, file_path);
CREATE INDEX idx_repo_chunks_type ON repo_code_chunks(repository_id, chunk_type);
CREATE INDEX idx_repo_deps_source ON repo_dependencies(repository_id, source_file);
CREATE INDEX idx_repo_deps_target ON repo_dependencies(repository_id, target_file);
CREATE INDEX idx_repo_health_time ON repo_health_snapshots(repository_id, analyzed_at DESC);

-- pgvector index for fast similarity search
CREATE INDEX idx_repo_embeddings_vector ON repo_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);  -- adjust based on total vectors
```

### 9.5 Caching Strategy

| Data                | Cache Location        | TTL           | Invalidation |
| ------------------- | --------------------- | ------------- | ------------ |
| File tree           | PostgreSQL (existing) | Until reindex | Push event   |
| File content chunks | PostgreSQL            | Until reindex | SHA change   |
| Embeddings          | PostgreSQL            | Permanent     | Reindex      |
| Search results      | In-memory (LRU)       | 5 min         | Query change |
| Health scores       | PostgreSQL            | 24 hours      | Re-analyze   |
| Dependency graph    | PostgreSQL            | Until reindex | Reindex      |

### 9.6 Memory Management

- Stream large file contents instead of buffering
- Use cursor-based pagination for search results
- Limit concurrent embedding generation (max 3)
- Clean up old health snapshots (keep last 30 per repo)

---

## 10. Security Considerations

### 10.1 Access Control

```
User requests repo-intel data for {owner}/{repo}
    │
    ├─> Verify user is authenticated (existing middleware)
    │
    ├─> Verify user has GitHub token connected
    │
    ├─> Verify user has access to the repository via GitHub API
    │   (octokit.rest.repos.get returns 200)
    │
    └─> Verify the repository index belongs to this user
        (userId match in repository_indexes table)
```

### 10.2 Data Isolation

- Each user's repository index is scoped to their `userId`
- Embeddings are stored per-repository with foreign key to `repository_indexes`
- No cross-user data leakage possible due to FK constraints
- Search queries are always filtered by `userId` + `owner` + `repo`

### 10.3 Code Content Security

| Concern         | Mitigation                                                        |
| --------------- | ----------------------------------------------------------------- |
| Secrets in code | Embedding service skips `.env`, `.env.*` files                    |
| Large files     | Max chunk size 50KB; content truncated                            |
| Sensitive paths | Configurable exclude patterns (default: `.env`, `*.key`, `*.pem`) |
| Token exposure  | GitHub tokens never stored in embeddings; always encrypted in DB  |

### 10.4 Rate Limiting

```typescript
// Per-user rate limits for repo-intel endpoints
const RATE_LIMITS = {
  search: { windowMs: 60_000, max: 30 }, // 30 searches/min
  overview: { windowMs: 60_000, max: 10 }, // 10 overview loads/min
  health: { windowMs: 300_000, max: 5 }, // 5 health analyses/5min
  embed: { windowMs: 3600_000, max: 100 }, // 100 embedding jobs/hour
};
```

### 10.5 Input Validation

All user inputs validated with Zod schemas:

```typescript
const searchSchema = z.object({
  owner: z
    .string()
    .min(1)
    .max(39)
    .regex(/^[a-zA-Z0-9-]+$/),
  repo: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9._-]+$/),
  query: z.string().min(1).max(1000),
  branch: z.string().max(100).default('main'),
  fileFilter: z.string().max(500).optional(),
  languageFilter: z.string().max(50).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  threshold: z.number().min(0).max(1).default(0.7),
});
```

### 10.6 Embedding Data Retention

- Embeddings are deleted when user disconnects GitHub
- Embeddings are deleted when repository index is deleted
- Health snapshots retained for 90 days, then auto-cleaned
- No embedding data shared between users or organizations

---

## 11. Sequence Diagram

### 11.1 GitHub Connection → Repository Indexing → AI Query

```
┌──────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│User  │     │ Frontend │     │ API      │     │ GitHub   │     │ Database │
│      │     │ (React)  │     │(Fastify) │     │   API    │     │(Postgres)│
└──┬───┘     └────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
   │              │                │                │                │
   │  1. Connect  │                │                │                │
   │  GitHub      │                │                │                │
   │─────────────>│                │                │                │
   │              │  GET /github/  │                │                │
   │              │  auth-url      │                │                │
   │              │───────────────>│                │                │
   │              │                │  Generate      │                │
   │              │                │  OAuth URL     │                │
   │              │<───────────────│                │                │
   │              │                │                │                │
   │  2. Redirect │                │                │                │
   │  to GitHub   │                │                │                │
   │<─────────────│                │                │                │
   │──────────────│───────────────>│                │                │
   │              │                │  Exchange code │                │
   │              │                │  for token     │                │
   │              │                │───────────────>│                │
   │              │                │  Access token  │                │
   │              │                │<───────────────│                │
   │              │                │  Encrypt +     │                │
   │              │                │  store token   │                │
   │              │                │───────────────────────────────>│
   │              │                │                │                │
   │  3. Select   │                │                │                │
   │  Repository  │                │                │                │
   │─────────────>│                │                │                │
   │              │  GET /github/  │                │                │
   │              │  repositories  │                │                │
   │              │───────────────>│                │                │
   │              │                │  List repos    │                │
   │              │                │───────────────>│                │
   │              │                │  Repos[]       │                │
   │              │                │<───────────────│                │
   │              │<───────────────│                │                │
   │              │                │                │                │
   │  4. Start    │                │                │                │
   │  Indexing    │                │                │                │
   │─────────────>│                │                │                │
   │              │  POST /repo-   │                │                │
   │              │  intel/index   │                │                │
   │              │───────────────>│                │                │
   │              │                │  Check status  │                │
   │              │                │───────────────────────────────>│
   │              │                │<───────────────────────────────│
   │              │                │                │                │
   │              │                │  [Phase 1: Tree Fetch]         │
   │              │                │  GET /git/     │                │
   │              │                │  trees/{branch}│                │
   │              │                │───────────────>│                │
   │              │                │  Tree data     │                │
   │              │                │<───────────────│                │
   │              │                │                │                │
   │              │                │  [Phase 2: Content Fetch]      │
   │              │                │  GET /contents │                │
   │              │                │  /{path} (x50) │                │
   │              │                │───────────────>│                │
   │              │                │  File contents │                │
   │              │                │<───────────────│                │
   │              │                │                │                │
   │              │                │  [Phase 3: AST Analysis]       │
   │              │                │  Parse imports/exports         │
   │              │                │  Build dependency graph        │
   │              │                │───────────────────────────────>│
   │              │                │                │                │
   │              │                │  [Phase 4: Chunking]           │
   │              │                │  Split files into chunks       │
   │              │                │  Classify chunk types          │
   │              │                │───────────────────────────────>│
   │              │                │                │                │
   │              │                │  [Phase 5: Embeddings]         │
   │              │                │  POST /embeddings (batch)      │
   │              │                │  Gemini API    │                │
   │              │                │───────────────>│                │
   │              │                │  Vectors[]     │                │
   │              │                │<───────────────│                │
   │              │                │  Store vectors │                │
   │              │                │───────────────────────────────>│
   │              │                │                │                │
   │              │                │  [Phase 6: Finalize]           │
   │              │                │  Mark READY    │                │
   │              │                │───────────────────────────────>│
   │              │  Status: READY │                │                │
   │              │<───────────────│                │                │
   │              │                │                │                │
   │  5. AI Query  │                │                │                │
   │─────────────>│                │                │                │
   │              │  POST /repo-   │                │                │
   │              │  intel/search  │                │                │
   │              │───────────────>│                │                │
   │              │                │  [Embed query] │                │
   │              │                │  Gemini API    │                │
   │              │                │───────────────>│                │
   │              │                │  Query vector  │                │
   │              │                │<───────────────│                │
   │              │                │                │                │
   │              │                │  [Vector search]               │
   │              │                │  SELECT ...    │                │
   │              │                │  ORDER BY      │                │
   │              │                │  embedding <=> │                │
   │              │                │───────────────────────────────>│
   │              │                │  Results[]     │                │
   │              │                │<───────────────────────────────│
   │              │                │                │                │
   │              │                │  [Build AI context]            │
   │              │                │  [Generate response via SSE]   │
   │              │  SSE Stream    │                │                │
   │              │<───────────────│                │                │
   │  Response    │                │                │                │
   │<─────────────│                │                │                │
   │              │                │                │                │
```

---

## 12. REST API Contracts

All endpoints prefixed with `/api/v1/repo-intel`. All require authentication.

### 12.1 POST `/repo-intel/index`

Start repository indexing with enhanced analysis.

**Request:**

```json
{
  "owner": "sharadpawar05",
  "repo": "Devpilot-AI",
  "branch": "main",
  "includeEmbeddings": true,
  "chunkSize": "medium"
}
```

**Response (202 Accepted):**

```json
{
  "success": true,
  "data": {
    "indexId": "uuid",
    "status": "INDEXING",
    "phases": ["tree", "content", "ast", "chunks", "embeddings"],
    "estimatedDurationMs": 45000
  }
}
```

### 12.2 GET `/repo-intel/status`

Check indexing status with phase progress.

**Query:** `?owner=...&repo=...&branch=main`

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "INDEXING_AST",
    "currentPhase": "ast",
    "progress": {
      "tree": { "status": "complete", "duration": 2100 },
      "content": { "status": "complete", "duration": 8500, "filesProcessed": 47 },
      "ast": { "status": "in_progress", "filesProcessed": 120, "totalFiles": 340 },
      "chunks": { "status": "pending" },
      "embeddings": { "status": "pending" }
    },
    "commitSha": "abc123...",
    "indexedAt": null,
    "totalFiles": 340,
    "totalChunks": 0,
    "totalEmbeddings": 0
  }
}
```

### 12.3 GET `/repo-intel/overview`

Get repository overview with stats and health summary.

**Query:** `?owner=...&repo=...&branch=main`

**Response:**

```json
{
  "success": true,
  "data": {
    "stats": {
      "totalFiles": 340,
      "totalDirectories": 45,
      "totalSize": 1250000,
      "componentCount": 28,
      "hookCount": 12,
      "apiRouteCount": 15,
      "testFileCount": 42,
      "configFiles": ["package.json", "tsconfig.json"],
      "keyFiles": ["README.md", "CONTRIBUTING.md"]
    },
    "languageBreakdown": {
      "TypeScript": { "files": 180, "totalSize": 850000 },
      "JavaScript": { "files": 20, "totalSize": 45000 },
      "CSS": { "files": 35, "totalSize": 120000 },
      "Markdown": { "files": 8, "totalSize": 35000 }
    },
    "architecture": {
      "moduleCount": 15,
      "entryPoints": ["apps/web/src/main.tsx", "apps/api/src/server.ts"],
      "topModules": [
        { "name": "components", "path": "apps/web/src/components", "fileCount": 45 },
        { "name": "features", "path": "apps/api/src/features", "fileCount": 32 }
      ],
      "dependencyDepth": 4
    },
    "healthScore": 78,
    "recentCommits": [
      {
        "sha": "abc123...",
        "message": "feat: add repository intelligence",
        "author": "Sharad",
        "date": "2026-08-04T10:00:00Z"
      }
    ],
    "recentPRs": [
      {
        "number": 9,
        "title": "Feature/code review redesign",
        "state": "merged",
        "mergedAt": "2026-08-03T16:01:00Z"
      }
    ],
    "indexedAt": "2026-08-04T10:30:00Z",
    "commitSha": "abc123..."
  }
}
```

### 12.4 GET `/repo-intel/explorer`

Get architecture/dependency data.

**Query:** `?owner=...&repo=...&branch=main`

**Response:**

```json
{
  "success": true,
  "data": {
    "modules": [
      {
        "id": "mod_1",
        "path": "apps/web/src/components",
        "name": "components",
        "type": "component",
        "fileCount": 45,
        "totalSize": 320000,
        "imports": ["@/lib/utils", "@/hooks/*"],
        "exports": ["Navbar", "Sidebar", "Footer"]
      }
    ],
    "dependencies": [
      {
        "source": "apps/web/src/pages/playground.tsx",
        "target": "apps/web/src/hooks/use-chat.ts",
        "importType": "named",
        "importNames": ["useChat"]
      }
    ],
    "entryPoints": ["apps/web/src/main.tsx", "apps/api/src/server.ts"],
    "circularDependencies": [],
    "moduleClusters": [
      {
        "name": "AI Core",
        "modules": ["ai-core", "ai-providers", "ai-prompts"],
        "internalDeps": 12
      }
    ]
  }
}
```

### 12.5 POST `/repo-intel/search`

Semantic + keyword hybrid search.

**Request:**

```json
{
  "owner": "sharadpawar05",
  "repo": "Devpilot-AI",
  "branch": "main",
  "query": "authentication middleware JWT verification",
  "fileFilter": "apps/api",
  "languageFilter": "TypeScript",
  "limit": 15,
  "threshold": 0.7
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "query": "authentication middleware JWT verification",
    "totalResults": 8,
    "results": [
      {
        "filePath": "apps/api/src/core/auth/middleware.ts",
        "fileName": "middleware.ts",
        "language": "TypeScript",
        "score": 0.94,
        "snippet": "export async function authenticate(request: FastifyRequest, reply: FastifyReply) {\n  const token = extractToken(request);\n  if (!token) throw new UnauthorizedError();\n  const payload = await jwtVerify(token, ...);",
        "startLine": 12,
        "endLine": 28,
        "matchType": "semantic",
        "chunkType": "function",
        "chunkName": "authenticate"
      }
    ],
    "searchTimeMs": 340
  }
}
```

### 12.6 GET `/repo-intel/health`

Get code health analysis.

**Query:** `?owner=...&repo=...&branch=main&forceRefresh=false`

**Response:**

```json
{
  "success": true,
  "data": {
    "overallScore": 78,
    "metrics": [
      {
        "category": "quality",
        "name": "Code Complexity",
        "score": 82,
        "description": "Average cyclomatic complexity is moderate",
        "details": "12 functions have complexity > 10"
      },
      {
        "category": "security",
        "name": "Dependency Vulnerabilities",
        "score": 90,
        "description": "No known vulnerabilities in dependencies"
      },
      {
        "category": "maintainability",
        "name": "Documentation Coverage",
        "score": 65,
        "description": "45% of exported functions have JSDoc comments"
      },
      {
        "category": "testing",
        "name": "Test Coverage",
        "score": 70,
        "description": "Estimated 68% test coverage based on test file analysis"
      }
    ],
    "techDebt": [
      {
        "severity": "medium",
        "file": "apps/web/src/pages/playground.tsx",
        "description": "File exceeds 800 lines - consider splitting",
        "lineCount": 827
      }
    ],
    "recommendations": [
      {
        "priority": "high",
        "category": "testing",
        "title": "Add integration tests for auth middleware",
        "description": "The authentication middleware has no test coverage. Add integration tests to verify JWT verification and token refresh logic.",
        "affectedFiles": ["apps/api/src/core/auth/middleware.ts"]
      }
    ],
    "securityAlerts": [],
    "analyzedAt": "2026-08-04T10:35:00Z",
    "commitSha": "abc123..."
  }
}
```

### 12.7 DELETE `/repo-intel/index`

Delete repository index and all associated data.

**Request:**

```json
{
  "owner": "sharadpawar05",
  "repo": "Devpilot-AI",
  "branch": "main"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "deletedChunks": 2450,
    "deletedEmbeddings": 2450,
    "deletedDependencies": 1800,
    "deletedHealthSnapshots": 5
  }
}
```

### 12.8 GET `/repo-intel/chunks`

Get code chunks for a specific file.

**Query:** `?owner=...&repo=...&branch=main&path=apps/api/src/core/auth/middleware.ts`

**Response:**

```json
{
  "success": true,
  "data": {
    "filePath": "apps/api/src/core/auth/middleware.ts",
    "totalChunks": 4,
    "chunks": [
      {
        "id": "chunk_uuid",
        "content": "export async function authenticate(...)",
        "startLine": 12,
        "endLine": 45,
        "chunkType": "function",
        "name": "authenticate",
        "language": "TypeScript",
        "hasEmbedding": true
      }
    ]
  }
}
```

---

## 13. Folder Structure

### 13.1 Backend

```
apps/api/src/
├── features/
│   ├── repo-intelligence/              # NEW: Repository Intelligence module
│   │   ├── index.ts                    # Route registration
│   │   ├── types.ts                    # RI-specific types
│   │   ├── routes/
│   │   │   ├── index.ts                # Route aggregation
│   │   │   ├── overview-routes.ts      # GET /repo-intel/overview
│   │   │   ├── explorer-routes.ts      # GET /repo-intel/explorer
│   │   │   ├── search-routes.ts        # POST /repo-intel/search
│   │   │   ├── health-routes.ts        # GET /repo-intel/health
│   │   │   ├── index-routes.ts         # POST /repo-intel/index, DELETE /repo-intel/index
│   │   │   └── chunk-routes.ts         # GET /repo-intel/chunks
│   │   ├── services/
│   │   │   ├── indexing-service.ts      # Enhanced indexing pipeline
│   │   │   ├── search-service.ts        # Hybrid vector + keyword search
│   │   │   ├── overview-service.ts      # Repository overview aggregation
│   │   │   ├── explorer-service.ts      # Architecture/dependency analysis
│   │   │   ├── health-analyzer.ts       # Code health metrics
│   │   │   ├── embedding-service.ts     # Embedding generation + storage
│   │   │   └── dependency-analyzer.ts   # Import/export graph analysis
│   │   ├── analyzers/
│   │   │   ├── ast-analyzer.ts          # TypeScript/JS AST parsing
│   │   │   ├── complexity-analyzer.ts   # Cyclomatic complexity
│   │   │   ├── test-analyzer.ts         # Test coverage estimation
│   │   │   └── security-analyzer.ts     # Security pattern detection
│   │   ├── prompts/
│   │   │   ├── repository-intelligence.md  # Main RI prompt template
│   │   │   ├── health-analysis.md       # Health analysis prompt
│   │   │   └── architecture-summary.md  # Architecture summary prompt
│   │   └── utils/
│   │       ├── graph.ts                 # Graph data structure utilities
│   │       ├── scoring.ts              # Health score computation
│   │       └── github-rate-limiter.ts  # GitHub API rate limit handling
│   │
│   └── repository-chat/                # EXISTING: Unchanged
│       ├── chat-routes.ts
│       ├── indexer.ts
│       ├── cache.ts
│       ├── parser.ts
│       ├── analyzer.ts
│       ├── status.ts
│       ├── types.ts
│       ├── repository-routes.ts
│       └── index.ts
│
├── core/
│   └── github/
│       ├── crypto.ts                   # EXISTING: unchanged
│       ├── token.ts                    # EXISTING: unchanged
│       ├── routes.ts                   # EXISTING: unchanged
│       └── index.ts                    # EXISTING: unchanged
│
└── routes/
    └── index.ts                        # MODIFIED: add repo-intelligence routes
```

### 13.2 Frontend

```
apps/web/src/
├── pages/
│   ├── repository-intelligence/        # NEW: Repository Intelligence pages
│   │   ├── index.tsx                   # Main RI page with tabs
│   │   ├── overview/
│   │   │   ├── index.tsx               # Overview tab
│   │   │   ├── repo-stats-card.tsx     # File/size/dir stats
│   │   │   ├── language-chart.tsx      # Language breakdown chart
│   │   │   ├── architecture-preview.tsx # Mini arch graph
│   │   │   ├── recent-activity.tsx     # Recent commits/PRs
│   │   │   └── health-summary.tsx      # Quick health score
│   │   ├── explorer/
│   │   │   ├── index.tsx               # Explorer tab
│   │   │   ├── dependency-graph.tsx    # Force-directed graph
│   │   │   ├── module-tree.tsx         # Hierarchical modules
│   │   │   ├── data-flow.tsx           # Data flow diagram
│   │   │   └── file-detail-panel.tsx   # File details sidebar
│   │   ├── search/
│   │   │   ├── index.tsx               # Search tab
│   │   │   ├── search-bar.tsx          # Search input + filters
│   │   │   ├── search-results.tsx      # Results list
│   │   │   └── result-preview.tsx      # Code preview
│   │   └── health/
│   │       ├── index.tsx               # Health tab
│   │       ├── health-score-ring.tsx   # Score visualization
│   │       ├── metrics-grid.tsx        # Quality metrics cards
│   │       ├── tech-debt-list.tsx      # Tech debt items
│   │       └── recommendations.tsx     # AI recommendations
│   │
│   └── repository-chat/               # EXISTING: unchanged
│
├── components/
│   ├── repo-intelligence/             # NEW: RI shared components
│   │   ├── repository-selector.tsx    # Repo + branch picker
│   │   ├── indexing-banner.tsx        # Indexing progress banner
│   │   ├── indexing-progress.tsx      # Phase-by-phase progress
│   │   ├── score-ring.tsx             # Reusable score ring
│   │   ├── metric-card.tsx            # Reusable metric card
│   │   ├── code-preview.tsx           # Syntax-highlighted code block
│   │   └── dependency-edge.tsx        # Graph edge component
│   │
│   ├── shared/                        # EXISTING: unchanged
│   └── workspace/                     # EXISTING: unchanged
│
├── hooks/
│   ├── use-repo-intelligence.ts       # NEW: Main RI hook
│   ├── use-repo-search.ts             # NEW: Search hook
│   ├── use-repo-health.ts             # NEW: Health analysis hook
│   ├── use-repo-explorer.ts           # NEW: Explorer hook
│   └── use-repository-chat.ts         # EXISTING: unchanged
│
├── lib/
│   ├── repo-intelligence/             # NEW: RI API client
│   │   ├── api.ts                     # API client methods
│   │   ├── types.ts                   # Frontend types
│   │   └── queries.ts                 # React Query key factories
│   │
│   └── utils.ts                       # EXISTING: unchanged
│
├── routes/
│   └── index.tsx                      # MODIFIED: add /repo-intelligence route
│
└── components/
    └── navigation/
        └── sidebar.tsx                # MODIFIED: add RI nav item
```

### 13.3 Packages

```
packages/
├── ai-prompts/
│   └── src/
│       └── templates/
│           ├── repository-intelligence.md   # NEW
│           ├── health-analysis.md           # NEW
│           ├── architecture-summary.md      # NEW
│           └── ... (existing templates)
│
├── types/
│   └── src/
│       └── index.ts                         # MODIFIED: add RI types
│
└── shared/
    └── src/
        └── index.ts                         # MODIFIED: add RI interfaces
```

---

## 14. UI Wireframes

### 14.1 Repository Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Repository Intelligence                                    [Select ▾] │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─ Overview ─┐ ┌─ Explorer ─┐ ┌─ Search ─┐ ┌─ Health ─┐              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 📊 Repository Stats                                             │   │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │   │
│  │ │ 340      │ │ 45       │ │ 1.2 MB   │ │ 28       │            │   │
│  │ │ Files    │ │ Dirs     │ │ Total    │ │ Components│           │   │
│  │ └──────────┘ └──────────┘ └──────────┘ └──────────┘            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────┐  ┌──────────────────────────────────┐   │
│  │ 🌐 Language Breakdown    │  │ 🏗️ Architecture Preview         │   │
│  │                          │  │                                  │   │
│  │ TypeScript ████████ 53%  │  │    ┌─────────┐                  │   │
│  │ CSS        ████     20%  │  │    │  apps/  │                  │   │
│  │ Markdown   ██       12%  │  │    └────┬────┘                  │   │
│  │ JavaScript █        8%   │  │    ┌────┴────┐                  │   │
│  │ JSON       █        7%   │  │  ┌─┴─┐    ┌──┴──┐              │   │
│  │                          │  │  │web│    │ api │              │   │
│  └──────────────────────────┘  │  └───┘    └─────┘              │   │
│                                └──────────────────────────────────┘   │
│  ┌──────────────────────────┐  ┌──────────────────────────────────┐   │
│  │ 📋 Recent Commits        │  │ 📈 Health Score                  │   │
│  │                          │  │                                  │   │
│  │ abc123 feat: repo intel  │  │      ┌──────────┐               │   │
│  │ def456 fix: streaming    │  │      │  78/100  │               │   │
│  │ ghi789 feat: redesign    │  │      │  Good    │               │   │
│  │                          │  │      └──────────┘               │   │
│  └──────────────────────────┘  └──────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 14.2 Architecture Explorer

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Repository Intelligence                                    [Select ▾] │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─ Overview ─┐ ┌─ Explorer ─┐ ┌─ Search ─┐ ┌─ Health ─┐              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────┐ ┌──────────────┐  │
│  │ 🔍 Filter: [All Modules ▾] [All Types ▾]        │ │              │  │
│  │                                                 │ │  File Detail │  │
│  │  ┌─────────────────────────────────────────┐   │ │              │  │
│  │  │                                         │   │ │  middleware.ts│  │
│  │  │    ┌─────────┐     ┌─────────┐          │   │ │  ────────────│  │
│  │  │    │  auth/  │────>│  core/  │          │   │ │  Lines: 65   │  │
│  │  │    └────┬────┘     └────┬────┘          │   │ │  Imports: 3  │  │
│  │  │         │               │               │   │ │  Exports: 1  │  │
│  │  │    ┌────┴────┐     ┌────┴────┐          │   │ │              │  │
│  │  │    │ routes/ │     │  ai/    │          │   │ │  Imported by:│  │
│  │  │    └─────────┘     └─────────┘          │   │ │  • routes.ts │  │
│  │  │                                         │   │ │  • server.ts │  │
│  │  │    ┌─────────┐     ┌─────────┐          │   │ │              │  │
│  │  │    │  db/    │<────│config/  │          │   │ │  Imports:    │  │
│  │  │    └─────────┘     └─────────┘          │   │ │  • jose      │  │
│  │  │                                         │   │ │  • db.ts     │  │
│  │  └─────────────────────────────────────────┘   │ │              │  │
│  │                                                 │ │  [View Code] │  │
│  │  ─────────────────────────────────────────────  │ │  [Ask AI]    │  │
│  │  Module Hierarchy                               │ │              │  │
│  │  ├── apps/web/src/                             │ │              │  │
│  │  │   ├── components/ (45 files)                │ │              │  │
│  │  │   ├── hooks/ (12 files)                     │ │              │  │
│  │  │   └── pages/ (8 files)                      │ │              │  │
│  │  ├── apps/api/src/                             │ │              │  │
│  │  │   ├── features/ (32 files)                  │ │              │  │
│  │  │   └── core/ (18 files)                      │ │              │  │
│  │  └── packages/                                 │ │              │  │
│  │      ├── ai-core/ (8 files)                    │ │              │  │
│  │      └── ai-providers/ (4 files)               │ │              │  │
│  └─────────────────────────────────────────────────┘ └──────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 14.3 Repository Search

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Repository Intelligence                                    [Select ▾] │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─ Overview ─┐ ┌─ Explorer ─┐ ┌─ Search ─┐ ┌─ Health ─┐              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 🔍 Search repository code...                                    │   │
│  │ ┌──────────────────────────────────────┬──────────────────────┐ │   │
│  │ │ authentication middleware JWT         │  [Search] [Filters]  │ │   │
│  │ └──────────────────────────────────────┴──────────────────────┘ │   │
│  │ Filters: [TypeScript ▾] [apps/api/ ▾] [Semantic+Keyword ▾]     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Found 8 results (340ms)                                               │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 📄 apps/api/src/core/auth/middleware.ts            Score: 0.94  │   │
│  │ ─────────────────────────────────────────────────────────────  │   │
│  │ 12│ export async function authenticate(                        │   │
│  │ 13│   request: FastifyRequest,                                 │   │
│  │ 14│   reply: FastifyReply                                      │   │
│  │ 15│ ) {                                                        │   │
│  │ 16│   const token = extractToken(request);                     │   │
│  │ 17│   if (!token) throw new UnauthorizedError();               │   │
│  │ 18│   const payload = await jwtVerify(token, ...);             │   │
│  │ ...│   // ... verified successfully                            │   │
│  │ 28│ }                                                          │   │
│  │ ─────────────────────────────────────────────────────────────  │   │
│  │ 📌 Function: authenticate  |  🔗 3 callers  |  📝 semantic    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 📄 apps/api/src/core/github/routes.ts              Score: 0.87  │   │
│  │ ─────────────────────────────────────────────────────────────  │   │
│  │ 45│   app.get('/github/auth-url', {                             │   │
│  │ 46│     preHandler: [authenticate],                             │   │
│  │ ...│                                                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 📄 apps/api/src/core/auth/decorators.ts             Score: 0.82  │   │
│  │ ─────────────────────────────────────────────────────────────  │   │
│  │ ... (similar structure)                                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 14.4 Health Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Repository Intelligence                                    [Select ▾] │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─ Overview ─┐ ┌─ Explorer ─┐ ┌─ Search ─┐ ┌─ Health ─┐              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Overall Health Score                                            │   │
│  │      ┌──────────┐                                               │   │
│  │      │          │   78 / 100                                   │   │
│  │      │   78     │   Status: Good                                │   │
│  │      │          │   Last analyzed: 2 hours ago                  │   │
│  │      └──────────┘   [Re-analyze]                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐          │
│  │ Quality    │ │ Security   │ │ Maintain-  │ │ Testing    │          │
│  │            │ │            │ │ ability    │ │            │          │
│  │    82      │ │    90      │ │    65      │ │    70      │          │
│  │ ████████░░ │ │ █████████░ │ │ ██████░░░░ │ │ ███████░░░ │          │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘          │
│                                                                         │
│  ┌──────────────────────────┐  ┌──────────────────────────────────┐   │
│  │ ⚠️ Technical Debt        │  │ 💡 Recommendations               │   │
│  │                          │  │                                  │   │
│  │ ⬤ MEDIUM                 │  │ 1. Add integration tests for    │   │
│  │ playground.tsx exceeds    │  │    auth middleware (HIGH)        │   │
│  │ 800 lines                │  │                                  │   │
│  │                          │  │ 2. Add JSDoc to 35 exported     │   │
│  │ ⬤ LOW                    │  │    functions (MEDIUM)            │   │
│  │ 12 functions lack error  │  │                                  │   │
│  │ handling                 │  │ 3. Split playground.tsx into     │   │
│  │                          │  │    3 smaller components (MED)    │   │
│  │ ⬤ LOW                    │  │                                  │   │
│  │ 3 files have > 500 lines │  │ 4. Upgrade deprecated APIs in   │   │
│  │                          │  │    2 files (LOW)                 │   │
│  └──────────────────────────┘  └──────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 📈 Health Trend                                                 │   │
│  │                                                                 │   │
│  │ 90│                                                             │   │
│  │ 80│              ●────●                                        │   │
│  │ 70│         ●────                                               │   │
│  │ 60│    ●────                                                     │   │
│  │ 50│●───                                                          │   │
│  │   └──────────────────────────────────────                       │   │
│  │    1w ago   3d ago   1d ago   today                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 15. Incremental Implementation Plan

Each PR is designed to be **independently reviewable**, **non-breaking**, and **testable**.

### Phase 1: Foundation (PRs 1-4)

| PR      | Title                                                        | Scope                                                                                                                                                                       | Est. Files |
| ------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **PR1** | `feat(repo-intel): add pgvector extension and new DB schema` | Prisma migration: new tables (`repo_code_chunks`, `repo_embeddings`, `repo_dependencies`, `repo_health_snapshots`), new enums, alter `repository_indexes`. No code changes. | 3          |
| **PR2** | `feat(repo-intel): add backend types and route skeleton`     | Create `features/repo-intelligence/` directory structure, types.ts, route stubs that return 501. Register routes in `routes/index.ts`.                                      | 8          |
| **PR3** | `feat(repo-intel): add frontend page shell and routing`      | Create `pages/repository-intelligence/` with tab navigation (placeholder tabs). Add route to `routes/index.tsx`. Add nav item to sidebar.                                   | 6          |
| **PR4** | `feat(repo-intel): add repository selector component`        | Reusable `RepositorySelector` component that fetches user's GitHub repos and allows branch selection. Shared between all tabs.                                              | 3          |

### Phase 2: Indexing Pipeline (PRs 5-8)

| PR      | Title                                                   | Scope                                                                                                                         | Est. Files |
| ------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **PR5** | `feat(repo-intel): enhance indexer with AST analysis`   | Extend `RepositoryIndexer` to parse imports/exports, build dependency graph. Store in `repo_dependencies` table.              | 5          |
| **PR6** | `feat(repo-intel): add code chunking service`           | Implement `CodeChunker` that splits files into semantic chunks (functions, classes, components). Store in `repo_code_chunks`. | 4          |
| **PR7** | `feat(repo-intel): add embedding service with pgvector` | Implement `EmbeddingService` using Gemini `text-embedding-004`. Batch generation, vector storage, similarity search SQL.      | 5          |
| **PR8** | `feat(repo-intel): add indexing progress UI`            | `IndexingBanner` and `IndexingProgress` components. Poll `/repo-intel/status` during indexing. Show phase-by-phase progress.  | 4          |

### Phase 3: Overview & Explorer (PRs 9-12)

| PR       | Title                                                  | Scope                                                                                                          | Est. Files |
| -------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ---------- |
| **PR9**  | `feat(repo-intel): implement overview service and API` | `OverviewService` aggregates stats, languages, architecture summary, recent commits/PRs. Full API endpoint.    | 4          |
| **PR10** | `feat(repo-intel): implement overview tab UI`          | `RepoStatsCard`, `LanguageChart`, `ArchitecturePreview`, `RecentActivity`, `HealthSummary` components.         | 7          |
| **PR11** | `feat(repo-intel): implement explorer service and API` | `ExplorerService` builds module hierarchy, dependency graph, circular dependency detection, module clustering. | 4          |
| **PR12** | `feat(repo-intel): implement explorer tab UI`          | `ModuleTree`, `DependencyGraph` (force-directed), `FileDetailPanel`. Interactive graph with zoom/pan.          | 6          |

### Phase 4: Search & Health (PRs 13-16)

| PR       | Title                                                 | Scope                                                                                                                      | Est. Files |
| -------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **PR13** | `feat(repo-intel): implement search service and API`  | `SearchService` with hybrid vector + keyword search. Result ranking, snippet generation.                                   | 4          |
| **PR14** | `feat(repo-intel): implement search tab UI`           | `SearchBar`, `SearchResults`, `ResultPreview` with syntax highlighting. File filter and language filter controls.          | 5          |
| **PR15** | `feat(repo-intel): implement health analyzer and API` | `HealthAnalyzer` with complexity analysis, test coverage estimation, security pattern detection. Health score computation. | 6          |
| **PR16** | `feat(repo-intel): implement health tab UI`           | `HealthScoreRing`, `MetricsGrid`, `TechDebtList`, `Recommendations` components. Historical trend chart.                    | 6          |

### Phase 5: AI Integration (PRs 17-19)

| PR       | Title                                                            | Scope                                                                                                                         | Est. Files |
| -------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **PR17** | `feat(repo-intel): add AI context builder pipeline`              | `AIContextBuilder` that assembles repository metadata, relevant chunks, dependency context into structured prompt context.    | 4          |
| **PR18** | `feat(repo-intel): add repository intelligence prompt templates` | Add `repository-intelligence.md`, `health-analysis.md`, `architecture-summary.md` prompt templates to `ai-prompts` package.   | 3          |
| **PR19** | `feat(repo-intel): wire AI queries to context pipeline`          | Connect search results + context builder to AI workflow engine. SSE streaming for AI responses. "Ask AI" buttons on all tabs. | 5          |

### Phase 6: Polish & Production (PRs 20-22)

| PR       | Title                                                                  | Scope                                                                                                   | Est. Files |
| -------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------- |
| **PR20** | `feat(repo-intel): add rate limiting and error handling`               | Per-user rate limits, graceful error handling, retry logic for GitHub API. Rate limit UI feedback.      | 4          |
| **PR21** | `feat(repo-intel): add incremental reindexing`                         | Detect changed files on reindex. Only re-chunk and re-embed modified files. SHA-based change detection. | 3          |
| **PR22** | `feat(repo-intel): add empty states, loading states, and error states` | Comprehensive empty states for each tab. Loading skeletons. Error boundaries. Retry buttons.            | 5          |

### Dependency Graph

```
PR1 ──> PR2 ──> PR3 ──> PR4
                 │
                 ├──> PR5 ──> PR6 ──> PR7 ──> PR8
                 │                     │
                 │                     ├──> PR13 ──> PR14
                 │                     │
                 │                     └──> PR15 ──> PR16
                 │
                 ├──> PR9 ──> PR10
                 │
                 └──> PR11 ──> PR12
                               │
                               └──> PR17 ──> PR18 ──> PR19
                                                       │
                                                       └──> PR20 ──> PR21 ──> PR22
```

### Estimated Total Effort

| Phase                        | PRs        | Estimated Days |
| ---------------------------- | ---------- | -------------- |
| Phase 1: Foundation          | PR1-PR4    | 3-4 days       |
| Phase 2: Indexing            | PR5-PR8    | 4-5 days       |
| Phase 3: Overview & Explorer | PR9-PR12   | 5-6 days       |
| Phase 4: Search & Health     | PR13-PR16  | 5-6 days       |
| Phase 5: AI Integration      | PR17-PR19  | 3-4 days       |
| Phase 6: Polish              | PR20-PR22  | 2-3 days       |
| **Total**                    | **22 PRs** | **22-28 days** |

---

_End of Architecture Design Document_
