/**
 * Minimal, dependency-free metrics registry.
 *
 * Deliberately not `prom-client`: the app only needs counters, gauges and one
 * histogram family, and the audit brief forbids adding monitoring services
 * without approval. The output is standard Prometheus text exposition format
 * so any scraper can consume it later if the project adopts one.
 *
 * Cardinality is bounded by design: labels only ever carry route templates,
 * method, status codes, provider names and fixed feature keys — never user,
 * repository or prompt values.
 */

export type Labels = Record<string, string | number>;

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function formatLabels(labels?: Labels): string {
  if (!labels) return '';
  const keys = Object.keys(labels).sort();
  if (keys.length === 0) return '';
  const body = keys.map((k) => `${k}="${escapeLabelValue(String(labels[k]))}"`).join(',');
  return `{${body}}`;
}

function labelKey(labels?: Labels): string {
  if (!labels) return '';
  const keys = Object.keys(labels).sort();
  return keys.map((k) => `${k}=${String(labels[k])}`).join(',');
}

function assertMetricName(name: string): void {
  if (!/^[a-zA-Z_:][a-zA-Z0-9_:]*$/.test(name)) {
    throw new Error(`Invalid metric name: ${name}`);
  }
}

abstract class Metric {
  readonly name: string;
  readonly help: string;

  constructor(name: string, help: string) {
    assertMetricName(name);
    this.name = name;
    this.help = help;
  }

  abstract get type(): string;
  abstract renderSeries(): string[];
  abstract reset(): void;

  header(): string {
    return `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} ${this.type}`;
  }
}

export class Counter extends Metric {
  private values = new Map<string, { labels?: Labels; value: number }>();

  override get type(): string {
    return 'counter';
  }

  inc(labels?: Labels, value = 1): void {
    if (value < 0) {
      throw new Error(`Counter ${this.name} cannot decrease`);
    }
    const key = labelKey(labels);
    const existing = this.values.get(key);
    if (existing) {
      existing.value += value;
    } else {
      this.values.set(key, { labels, value });
    }
  }

  get(labels?: Labels): number {
    return this.values.get(labelKey(labels))?.value ?? 0;
  }

  reset(): void {
    this.values.clear();
  }

  override renderSeries(): string[] {
    if (this.values.size === 0) {
      return [`${this.name}${formatLabels()} 0`];
    }
    return [...this.values.values()].map(
      ({ labels, value }) => `${this.name}${formatLabels(labels)} ${value}`,
    );
  }
}

export class Gauge extends Metric {
  private values = new Map<string, { labels?: Labels; value: number }>();

  override get type(): string {
    return 'gauge';
  }

  set(labels: Labels | undefined, value: number): void {
    this.values.set(labelKey(labels), { labels, value });
  }

  inc(labels?: Labels, value = 1): void {
    const key = labelKey(labels);
    const existing = this.values.get(key);
    if (existing) {
      existing.value += value;
    } else {
      this.values.set(key, { labels, value });
    }
  }

  dec(labels?: Labels, value = 1): void {
    this.inc(labels, -value);
  }

  get(labels?: Labels): number {
    return this.values.get(labelKey(labels))?.value ?? 0;
  }

  reset(): void {
    this.values.clear();
  }

  override renderSeries(): string[] {
    if (this.values.size === 0) {
      return [`${this.name} 0`];
    }
    return [...this.values.values()].map(
      ({ labels, value }) => `${this.name}${formatLabels(labels)} ${value}`,
    );
  }
}

export interface HistogramSnapshot {
  buckets: number[];
  sum: number;
  count: number;
}

export class Histogram extends Metric {
  readonly bounds: number[];
  private series = new Map<
    string,
    { labels?: Labels; counts: number[]; sum: number; count: number }
  >();

  constructor(name: string, help: string, buckets: number[]) {
    super(name, help);
    if (buckets.length === 0) throw new Error(`Histogram ${name} needs buckets`);
    this.bounds = [...buckets].sort((a, b) => a - b);
  }

  override get type(): string {
    return 'histogram';
  }

  observe(labels: Labels | undefined, value: number): void {
    const key = labelKey(labels);
    let entry = this.series.get(key);
    if (!entry) {
      entry = { labels, counts: new Array(this.bounds.length).fill(0), sum: 0, count: 0 };
      this.series.set(key, entry);
    }
    entry.sum += value;
    entry.count += 1;
    for (let i = 0; i < this.bounds.length; i++) {
      if (value <= this.bounds[i]) {
        entry.counts[i] += 1;
      }
    }
  }

  get(labels?: Labels): HistogramSnapshot {
    const entry = this.series.get(labelKey(labels));
    if (!entry) {
      return { buckets: new Array(this.bounds.length).fill(0), sum: 0, count: 0 };
    }
    return { buckets: [...entry.counts], sum: entry.sum, count: entry.count };
  }

  reset(): void {
    this.series.clear();
  }

  override renderSeries(): string[] {
    const lines: string[] = [];
    const entries = this.series.size
      ? [...this.series.values()]
      : [{ labels: undefined, counts: new Array(this.bounds.length).fill(0), sum: 0, count: 0 }];
    for (const entry of entries) {
      const base = entry.labels ? { ...entry.labels } : undefined;
      for (let i = 0; i < this.bounds.length; i++) {
        lines.push(
          `${this.name}_bucket${formatLabels({ ...base, le: this.bounds[i] })} ${entry.counts[i]}`,
        );
      }
      lines.push(`${this.name}_bucket${formatLabels({ ...base, le: '+Inf' })} ${entry.count}`);
      lines.push(`${this.name}_sum${formatLabels(base)} ${entry.sum}`);
      lines.push(`${this.name}_count${formatLabels(base)} ${entry.count}`);
    }
    return lines;
  }
}

export class MetricsRegistry {
  private metrics: Metric[] = [];

  register<T extends Metric>(metric: T): T {
    this.metrics.push(metric);
    return metric;
  }

  render(): string {
    const blocks = this.metrics.map((metric) =>
      [metric.header(), ...metric.renderSeries()].join('\n'),
    );
    return `${blocks.join('\n\n')}\n`;
  }

  reset(): void {
    for (const metric of this.metrics) {
      metric.reset();
    }
  }
}

export const registry = new MetricsRegistry();
