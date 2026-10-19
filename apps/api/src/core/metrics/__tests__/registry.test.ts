import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsRegistry, Counter, Gauge, Histogram, type Labels } from '@/core/metrics/registry';

function renderWith(build: (registry: MetricsRegistry) => void): string {
  const registry = new MetricsRegistry();
  build(registry);
  return registry.render();
}

describe('Counter', () => {
  let counter: Counter;

  beforeEach(() => {
    counter = new Counter('http_requests_total', 'HTTP requests');
  });

  it('starts at zero for unknown label sets', () => {
    expect(counter.get({ method: 'GET' })).toBe(0);
  });

  it('increments and accumulates per label set', () => {
    counter.inc({ method: 'GET', status: 200 });
    counter.inc({ method: 'GET', status: 200 });
    counter.inc({ method: 'POST', status: 500 }, 3);

    expect(counter.get({ method: 'GET', status: 200 })).toBe(2);
    expect(counter.get({ method: 'POST', status: 500 })).toBe(3);
    expect(counter.get({ method: 'POST', status: 200 })).toBe(0);
  });

  it('rejects negative increments', () => {
    expect(() => counter.inc({ method: 'GET' }, -1)).toThrow(/cannot decrease/);
  });

  it('rejects invalid metric names at construction', () => {
    expect(() => new Counter('bad name', 'help')).toThrow(/Invalid metric name/);
  });

  it('renders zero series when never incremented', () => {
    const output = counter.renderSeries();
    expect(output).toEqual(['http_requests_total 0']);
  });
});

describe('Gauge', () => {
  it('supports inc/dec/set', () => {
    const gauge = new Gauge('ai_requests_in_flight', 'In-flight AI calls');
    gauge.inc();
    gauge.inc();
    gauge.dec();
    expect(gauge.get()).toBe(1);
    gauge.set(undefined, 7);
    expect(gauge.get()).toBe(7);
  });
});

describe('Histogram', () => {
  it('buckets observations and tracks sum/count', () => {
    const histogram = new Histogram(
      'http_request_duration_seconds',
      'Duration',
      [0.05, 0.25, 1, 5],
    );
    histogram.observe({ route: '/health' }, 0.02);
    histogram.observe({ route: '/health' }, 0.5);
    histogram.observe({ route: '/health' }, 10);

    const snap = histogram.get({ route: '/health' });
    expect(snap.count).toBe(3);
    expect(snap.sum).toBeCloseTo(10.52);
    // Buckets are cumulative: 0.02 <= 0.05; 0.5 <= 1; 10 only in +Inf.
    expect(snap.buckets[0]).toBe(1);
    expect(snap.buckets[1]).toBe(1);
    expect(snap.buckets[2]).toBe(2);
    expect(snap.buckets[3]).toBe(2);
  });

  it('requires at least one bucket', () => {
    expect(() => new Histogram('x_seconds', 'help', [])).toThrow(/needs buckets/);
  });

  it('sorts bounds defensively', () => {
    const histogram = new Histogram('x_seconds', 'help', [5, 0.1, 1]);
    expect(histogram.bounds).toEqual([0.1, 1, 5]);
  });
});

describe('MetricsRegistry', () => {
  it('renders registered metrics in Prometheus text format', () => {
    const output = renderWith((registry) => {
      const counter = registry.register(new Counter('api_hits_total', 'Hits'));
      counter.inc({ route: '/x', status: 200 });
    });

    expect(output).toContain('# HELP api_hits_total Hits');
    expect(output).toContain('# TYPE api_hits_total counter');
    expect(output).toContain('api_hits_total{route="/x",status="200"} 1');
  });

  it('escapes label values containing quotes, backslashes and newlines', () => {
    const output = renderWith((registry) => {
      const counter = registry.register(new Counter('escaped_total', 'Esc'));
      counter.inc({ msg: 'a"b\\c\nd' });
    });

    expect(output).toContain('msg="a\\"b\\\\c\\nd"');
  });

  it('resets all registered metrics', () => {
    const registry = new MetricsRegistry();
    const counter = registry.register(new Counter('x_total', 'X'));
    counter.inc();
    registry.reset();
    expect(counter.get()).toBe(0);
  });

  it('renders histogram series with _bucket/_sum/_count suffixes', () => {
    const output = renderWith((registry) => {
      const histogram = registry.register(new Histogram('lat_seconds', 'Latency', [1]));
      histogram.observe({ route: '/a' }, 0.5);
    });

    expect(output).toContain('lat_seconds_bucket{le="1",route="/a"} 1');
    expect(output).toContain('lat_seconds_bucket{le="+Inf",route="/a"} 1');
    expect(output).toContain('lat_seconds_sum{route="/a"} 0.5');
    expect(output).toContain('lat_seconds_count{route="/a"} 1');
  });
});

describe('shared registry instances', () => {
  it('exposes metrics with bounded labels via the module registry', async () => {
    const metrics = await import('@/core/metrics');
    const labels: Labels = { method: 'GET', route: '/health/live', status: 200 };
    metrics.httpRequestsTotal.inc(labels);
    expect(metrics.httpRequestsTotal.get(labels)).toBeGreaterThanOrEqual(1);
  });
});
