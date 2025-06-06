// /src/monitoring/GrafanaIntegration.ts
// Purpose: Exposes metrics in Prometheus format for Grafana scraping

import { createServer, Server } from 'node:http';
import { MetricsCollector, MetricsSnapshot } from './MetricsCollector.js';
import { BotConfigManager } from '../config/BotConfig.js';

/**
 * GrafanaIntegration class to expose metrics for Grafana
 */
export class GrafanaIntegration {
  private readonly metricsCollector: MetricsCollector;
  private readonly config = BotConfigManager.getInstance().getConfig();
  private server: Server | null = null;
  private readonly port: number;

  constructor(metricsCollector: MetricsCollector) {
    if (!metricsCollector) throw new Error('MetricsCollector is required');
    this.metricsCollector = metricsCollector;
    this.port = this.config.performance.metricsInterval ? 9090 : 0; // Default port if not configured
    console.log('📊 GrafanaIntegration initialized');
  }

  /**
   * Start the HTTP server to expose metrics
   */
  async start(): Promise<void> {
    if (!this.config.performance.enableMetrics) {
      console.log('⚠️ Metrics disabled in config, skipping Grafana integration');
      return;
    }

    this.server = createServer(async (req, res) => {
      if (req.url === '/metrics' && req.method === 'GET') {
        try {
          const snapshot = await this.metricsCollector.getMetricsSnapshot();
          const metrics = this.formatPrometheusMetrics(snapshot);
          res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
          res.end(metrics);
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end(`Error: ${(error as Error).message}`);
        }
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    return new Promise((resolve, reject) => {
      this.server?.listen(this.port, () => {
        console.log(\`🌐 Metrics server started on http://localhost:\${this.port}/metrics\`);
        resolve();
      }).on('error', (error) => {
        console.error(\`❌ Failed to start metrics server: \${error.message}\`);
        reject(error);
      });
    });
  }

  /**
   * Format metrics in Prometheus-compatible format
   * @param snapshot Metrics snapshot to format
   */
  private formatPrometheusMetrics(snapshot: MetricsSnapshot): string {
    const lines: string[] = [];
    const labels = 'app="solana-market-maker",env="' + this.config.environment + '"';

    lines.push(`# HELP trade_latency_avg_ms Average trade latency in milliseconds`);
    lines.push(`# TYPE trade_latency_avg_ms gauge`);
    lines.push(\`trade_latency_avg_ms{\${labels}} \${snapshot.avgLatencyMs}\`);

    lines.push(`# HELP trade_latency_p99_ms P99 trade latency in milliseconds`);
    lines.push(`# TYPE trade_latency_p99_ms gauge`);
    lines.push(\`trade_latency_p99_ms{\${labels}} \${snapshot.p99LatencyMs}\`);

    lines.push(`# HELP trade_success_rate Success rate of trades (0-1)`);
    lines.push(`# TYPE trade_success_rate gauge`);
    lines.push(\`trade_success_rate{\${labels}} \${snapshot.successRate}\`);

    lines.push(`# HELP trade_failure_count Total number of failed trades`);
    lines.push(`# TYPE trade_failure_count counter`);
    lines.push(\`trade_failure_count{\${labels}} \${snapshot.failureCount}\`);

    lines.push(`# HELP system_cpu_usage_percent CPU usage percentage`);
    lines.push(`# TYPE system_cpu_usage_percent gauge`);
    lines.push(\`system_cpu_usage_percent{\${labels}} \${snapshot.cpuUsagePercent}\`);

    lines.push(`# HELP system_memory_usage_mb Memory usage in megabytes`);
    lines.push(`# TYPE system_memory_usage_mb gauge`);
    lines.push(\`system_memory_usage_mb{\${labels}} \${snapshot.memoryUsageMb}\`);

    return lines.join('\n') + '\n';
  }

  /**
   * Stop the metrics server
   */
  async stop(): Promise<void> {
    if (!this.server) return;
    return new Promise((resolve, reject) => {
      this.server?.close((err) => {
        if (err) {
          console.error(\`❌ Failed to stop metrics server: \${err.message}\`);
          reject(err);
        } else {
          console.log('⏹️ Metrics server stopped');
          resolve();
        }
      });
    });
  }
}
