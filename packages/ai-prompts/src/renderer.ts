import type {
  PromptTemplate,
  PromptVariable,
  RenderedPrompt,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  PromptMetadata,
  PromptEngineConfig,
} from './types';

const DEFAULT_CONFIG: PromptEngineConfig = {
  cacheMaxSize: 100,
  cacheTtlMs: 5 * 60 * 1000,
  strictValidation: true,
  allowUnknownVariables: false,
};

interface CacheEntry {
  key: string;
  rendered: RenderedPrompt;
  hitCount: number;
  createdAt: Date;
  lastAccessedAt: Date;
}

function hashVariables(variables: Record<string, unknown>): string {
  const sorted = Object.keys(variables)
    .sort()
    .map((k) => `${k}=${JSON.stringify(variables[k])}`)
    .join('&');
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    const char = sorted.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export class PromptRenderer {
  private cache: Map<string, CacheEntry> = new Map();
  private config: PromptEngineConfig;

  constructor(config?: Partial<PromptEngineConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  validate(template: PromptTemplate, variables: Record<string, unknown>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const providedVars = new Set(Object.keys(variables));

    for (const variable of template.variables) {
      const value = variables[variable.name];

      if (value === undefined || value === null) {
        if (variable.required) {
          if (variable.default !== undefined) {
            warnings.push({
              variable: variable.name,
              message: `Required variable '${variable.name}' not provided, using default`,
              code: 'DEFAULT_USED',
            });
          } else {
            errors.push({
              variable: variable.name,
              message: `Required variable '${variable.name}' is missing`,
              code: 'MISSING_REQUIRED',
            });
          }
        }
        continue;
      }

      if (value === '') {
        // Empty string is only invalid for required variables; optional
        // variables treat '' the same as not provided.
        if (variable.required) {
          errors.push({
            variable: variable.name,
            message: `Variable '${variable.name}' has empty value`,
            code: 'EMPTY_VALUE',
          });
        }
        continue;
      }

      if (!this.validateType(value, variable.type)) {
        errors.push({
          variable: variable.name,
          message: `Variable '${variable.name}' expected type '${variable.type}', got '${typeof value}'`,
          code: 'TYPE_MISMATCH',
        });
      }

      providedVars.delete(variable.name);
    }

    if (!this.config.allowUnknownVariables) {
      for (const unknownVar of providedVars) {
        const isDeclared = template.variables.some((v) => v.name === unknownVar);
        if (!isDeclared) {
          warnings.push({
            variable: unknownVar,
            message: `Variable '${unknownVar}' is not declared in template`,
            code: 'UNUSED_VARIABLE',
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  render(
    template: PromptTemplate,
    variables: Record<string, unknown>,
    metadata?: PromptMetadata,
  ): RenderedPrompt {
    const resolved = this.resolveDefaults(template, variables);

    const validation = this.validate(template, resolved);
    if (!validation.valid && this.config.strictValidation) {
      const messages = validation.errors.map((e) => e.message).join('; ');
      throw new Error(`Prompt validation failed: ${messages}`);
    }

    const cacheKey = `${template.id}:${template.version}:${hashVariables(resolved)}`;

    const cached = this.cache.get(cacheKey);
    if (cached && !this.isExpired(cached)) {
      cached.hitCount++;
      cached.lastAccessedAt = new Date();
      return cached.rendered;
    }

    const systemPrompt = this.interpolate(template.systemPrompt, resolved);
    const userPrompt = this.interpolate(template.userPromptTemplate, resolved);

    const rendered: RenderedPrompt = {
      systemPrompt,
      userPrompt,
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
      renderedAt: new Date(),
      cacheKey,
    };

    this.setCache(cacheKey, rendered);

    return rendered;
  }

  interpolate(template: string, variables: Record<string, unknown>): string {
    let result = template;

    result = result.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, key, content) => {
      const value = variables[key];
      if (value !== undefined && value !== null && value !== '' && value !== false) {
        return this.interpolate(String(content), variables);
      }
      return '';
    });

    result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      if (key in variables) {
        const value = variables[key];
        return value === undefined || value === null ? '' : String(value);
      }
      return match;
    });

    return result;
  }

  getCached(cacheKey: string): RenderedPrompt | undefined {
    const entry = this.cache.get(cacheKey);
    if (entry && !this.isExpired(entry)) {
      entry.hitCount++;
      entry.lastAccessedAt = new Date();
      return entry.rendered;
    }
    if (entry) {
      this.cache.delete(cacheKey);
    }
    return undefined;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): { size: number; hitRate: number; totalHits: number } {
    let totalHits = 0;
    let totalAccess = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount;
      totalAccess += entry.hitCount + 1;
    }
    return {
      size: this.cache.size,
      hitRate: totalAccess > 0 ? totalHits / totalAccess : 0,
      totalHits,
    };
  }

  private resolveDefaults(
    template: PromptTemplate,
    variables: Record<string, unknown>,
  ): Record<string, unknown> {
    const resolved = { ...variables };
    for (const variable of template.variables) {
      if (resolved[variable.name] === undefined && variable.default !== undefined) {
        resolved[variable.name] = variable.default;
      }
    }
    return resolved;
  }

  private validateType(value: unknown, expectedType: PromptVariable['type']): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value)));
      case 'boolean':
        return typeof value === 'boolean' || value === 'true' || value === 'false';
      case 'array':
        return Array.isArray(value);
      default:
        return true;
    }
  }

  private isExpired(entry: CacheEntry): boolean {
    if (this.config.cacheTtlMs <= 0) return false;
    return Date.now() - entry.createdAt.getTime() > this.config.cacheTtlMs;
  }

  private setCache(key: string, rendered: RenderedPrompt): void {
    if (this.cache.size >= this.config.cacheMaxSize) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [k, v] of this.cache) {
        if (v.lastAccessedAt.getTime() < oldestTime) {
          oldestTime = v.lastAccessedAt.getTime();
          oldestKey = k;
        }
      }
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      key,
      rendered,
      hitCount: 0,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
    });
  }
}
