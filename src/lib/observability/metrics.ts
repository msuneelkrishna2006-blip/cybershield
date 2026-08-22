/**
 * CyberShield India — Observability / Prometheus-compatible Metrics
 *
 * Provides in-memory counters and histograms for platform monitoring.
 * In production: these would be exported to Prometheus/Grafana via /metrics endpoint.
 * For now: uses in-memory tracking with periodic DB persistence.
 */

/** Counter metric */
class Counter {
  private value = 0;
  private labels = new Map<string, number>();

  constructor(public readonly name: string, public readonly help: string) {}

  inc(labels?: Record<string, string>, amount = 1): void {
    this.value += amount;
    if (labels) {
      const key = Object.entries(labels).sort().map(([k, v]) => `${k}="${v}"`).join(',');
      this.labels.set(key, (this.labels.get(key) || 0) + amount);
    }
  }

  get(): number { return this.value; }

  getLabeled(): Map<string, number> { return new Map(this.labels); }

  toPrometheus(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    if (this.labels.size === 0) {
      lines.push(`${this.name} ${this.value}`);
    } else {
      for (const [labels, val] of this.labels) {
        lines.push(`${this.name}{${labels}} ${val}`);
      }
    }
    return lines.join('\n');
  }
}

/** Histogram metric (simplified — tracks count, sum, and p50/p95/p99) */
class Histogram {
  private values: number[] = [];
  private count = 0;
  private sum = 0;

  constructor(public readonly name: string, public readonly help: string) {}

  observe(value: number): void {
    this.values.push(value);
    this.count++;
    this.sum += value;
    // Keep only last 10000 observations to prevent memory leak
    if (this.values.length > 10000) {
      this.values = this.values.slice(-5000);
    }
  }

  getPercentile(p: number): number {
    if (this.values.length === 0) return 0;
    const sorted = [...this.values].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * (p / 100)) - 1;
    return sorted[Math.max(0, idx)];
  }

  getStats(): { count: number; sum: number; avg: number; p50: number; p95: number; p99: number } {
    return {
      count: this.count,
      sum: this.sum,
      avg: this.count > 0 ? this.sum / this.count : 0,
      p50: this.getPercentile(50),
      p95: this.getPercentile(95),
      p99: this.getPercentile(99),
    };
  }

  toPrometheus(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    lines.push(`${this.name}_count ${this.count}`);
    lines.push(`${this.name}_sum ${this.sum}`);
    return lines.join('\n');
  }
}

/**
 * Platform-wide metrics registry
 */
export const metrics = {
  // Request metrics
  httpRequestsTotal: new Counter('cybershield_http_requests_total', 'Total HTTP requests'),
  httpRequestDuration: new Histogram('cybershield_http_request_duration_ms', 'HTTP request duration in milliseconds'),
  httpErrors: new Counter('cybershield_http_errors_total', 'Total HTTP error responses'),

  // Scan metrics
  scansTotal: new Counter('cybershield_scans_total', 'Total scans performed'),
  scanDuration: new Histogram('cybershield_scan_duration_ms', 'Scan processing time in milliseconds'),
  scansHighRisk: new Counter('cybershield_scans_high_risk_total', 'High risk scans detected'),

  // Auth metrics
  loginAttempts: new Counter('cybershield_login_attempts_total', 'Total login attempts'),
  loginFailures: new Counter('cybershield_login_failures_total', 'Failed login attempts'),
  rateLimitHits: new Counter('cybershield_rate_limit_hits_total', 'Rate limit rejections'),

  // AI metrics
  aiCalls: new Counter('cybershield_ai_calls_total', 'Total AI provider calls'),
  aiErrors: new Counter('cybershield_ai_errors_total', 'AI provider errors'),
  aiFallbacks: new Counter('cybershield_ai_fallbacks_total', 'Heuristic fallback invocations'),
  aiLatency: new Histogram('cybershield_ai_latency_ms', 'AI provider response time'),

  // Emergency metrics
  sosTriggered: new Counter('cybershield_sos_triggered_total', 'SOS events triggered'),

  // Extension metrics
  extensionScans: new Counter('cybershield_extension_scans_total', 'Browser extension scans'),
};

/**
 * Returns all metrics in Prometheus text format
 */
export function getPrometheusMetrics(): string {
  return Object.values(metrics)
    .map(m => m.toPrometheus())
    .join('\n\n');
}

/**
 * Returns metrics as JSON for the admin dashboard
 */
export function getMetricsSummary(): Record<string, unknown> {
  return {
    requests: {
      total: metrics.httpRequestsTotal.get(),
      errors: metrics.httpErrors.get(),
      latency: metrics.httpRequestDuration.getStats(),
    },
    scans: {
      total: metrics.scansTotal.get(),
      highRisk: metrics.scansHighRisk.get(),
      latency: metrics.scanDuration.getStats(),
    },
    auth: {
      loginAttempts: metrics.loginAttempts.get(),
      loginFailures: metrics.loginFailures.get(),
      rateLimitHits: metrics.rateLimitHits.get(),
    },
    ai: {
      calls: metrics.aiCalls.get(),
      errors: metrics.aiErrors.get(),
      fallbacks: metrics.aiFallbacks.get(),
      latency: metrics.aiLatency.getStats(),
    },
    emergency: {
      sosTriggered: metrics.sosTriggered.get(),
    },
  };
}
