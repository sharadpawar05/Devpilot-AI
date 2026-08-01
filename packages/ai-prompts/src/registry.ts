import type { PromptTemplate, PromptCategory, PromptMetadata, PromptEngineConfig } from './types';
import { PromptRenderer } from './renderer';
import type { LoadedPrompt } from './loader';

interface RegistryEntry {
  template: PromptTemplate;
  metadata: PromptMetadata;
  registeredAt: Date;
}

export class PromptRegistry {
  private templates: Map<string, RegistryEntry> = new Map();
  private versions: Map<string, Map<number, RegistryEntry>> = new Map();
  private renderer: PromptRenderer;

  constructor(config?: Partial<PromptEngineConfig>) {
    this.renderer = new PromptRenderer(config);
  }

  register(template: PromptTemplate, metadata?: PromptMetadata): void {
    const entry: RegistryEntry = {
      template,
      metadata: metadata ?? {
        id: template.id,
        name: template.name,
        category: template.category,
        description: '',
        tags: [],
        version: template.version,
        author: 'unknown',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      registeredAt: new Date(),
    };

    this.templates.set(template.id, entry);

    if (!this.versions.has(template.id)) {
      this.versions.set(template.id, new Map());
    }
    this.versions.get(template.id)!.set(template.version, entry);
  }

  registerLoaded(loaded: LoadedPrompt): void {
    this.register(loaded.template, loaded.metadata);
  }

  registerAll(loaded: LoadedPrompt[]): void {
    for (const item of loaded) {
      this.registerLoaded(item);
    }
  }

  get(id: string): PromptTemplate | undefined {
    return this.templates.get(id)?.template;
  }

  getMetadata(id: string): PromptMetadata | undefined {
    return this.templates.get(id)?.metadata;
  }

  getEntry(id: string): RegistryEntry | undefined {
    return this.templates.get(id);
  }

  getVersion(id: string, version: number): PromptTemplate | undefined {
    return this.versions.get(id)?.get(version)?.template;
  }

  getAllVersions(id: string): PromptTemplate[] {
    const versionMap = this.versions.get(id);
    if (!versionMap) return [];
    return Array.from(versionMap.values())
      .sort((a, b) => b.template.version - a.template.version)
      .map((e) => e.template);
  }

  getLatestVersion(id: string): PromptTemplate | undefined {
    const versions = this.getAllVersions(id);
    return versions[0];
  }

  getByCategory(category: PromptCategory): PromptTemplate[] {
    return Array.from(this.templates.values())
      .filter((e) => e.template.category === category)
      .map((e) => e.template);
  }

  search(query: string): PromptTemplate[] {
    const lower = query.toLowerCase();
    return Array.from(this.templates.values())
      .filter(
        (e) =>
          e.template.name.toLowerCase().includes(lower) ||
          e.template.id.toLowerCase().includes(lower) ||
          e.metadata.description.toLowerCase().includes(lower) ||
          e.metadata.tags.some((t) => t.toLowerCase().includes(lower)),
      )
      .map((e) => e.template);
  }

  getByTag(tag: string): PromptTemplate[] {
    return Array.from(this.templates.values())
      .filter((e) => e.metadata.tags.includes(tag))
      .map((e) => e.template);
  }

  render(id: string, variables: Record<string, unknown>) {
    const template = this.get(id);
    if (!template) {
      throw new Error(`Template '${id}' not found in registry`);
    }
    const metadata = this.getMetadata(id);
    return this.renderer.render(template, variables, metadata);
  }

  validate(id: string, variables: Record<string, unknown>) {
    const template = this.get(id);
    if (!template) {
      throw new Error(`Template '${id}' not found in registry`);
    }
    return this.renderer.validate(template, variables);
  }

  remove(id: string): boolean {
    this.versions.delete(id);
    return this.templates.delete(id);
  }

  clear(): void {
    this.templates.clear();
    this.versions.clear();
    this.renderer.clearCache();
  }

  list(): Array<{ id: string; name: string; category: PromptCategory; version: number }> {
    return Array.from(this.templates.values()).map((e) => ({
      id: e.template.id,
      name: e.template.name,
      category: e.template.category,
      version: e.template.version,
    }));
  }

  get size(): number {
    return this.templates.size;
  }

  get rendererInstance(): PromptRenderer {
    return this.renderer;
  }
}
