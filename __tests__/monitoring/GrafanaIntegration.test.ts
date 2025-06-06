// __tests__/monitoring/GrafanaIntegration.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GrafanaIntegration } from '../../src/monitoring/GrafanaIntegration.js';
import { MetricsCollector } from '../../src/monitoring/MetricsCollector.js';
import Redis from 'ioredis';
import { request } from 'node:http';

describe('GrafanaIntegration', () => {
  let integration: GrafanaIntegration;
  let metricsCollector: MetricsCollector;

  beforeEach(() => {
    process.env = { ENABLE_METRICS: 'true', REDIS_URL: 'redis://localhost:6379' };
    metricsCollector = new MetricsCollector(new Redis());
    integration = new GrafanaIntegration(metricsCollector);
  });

  afterEach(async () => {
    await integration.stop();
  });

  it('should start metrics server and expose /metrics endpoint', async () => {
    await metricsCollector.recordTrade({ success: true, transactionId: 'mockTx', executionTime: 120, slippageAchieved: 0.05 });
    await integration.start();

    const response = await new Promise((resolve, reject) => {
      const req = request('http://localhost:9090/metrics', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      req.on('error', reject);
      req.end();
    });

    expect(response.status).toBe(200);
    expect(response.data).toContain('trade_latency_avg_ms');
    expect(response.data).toContain('app="solana-market-maker"');
  });

  it('should handle invalid routes with 404', async () => {
    await integration.start();
    const response = await new Promise((resolve, reject) => {
      const req = request('http://localhost:9090/invalid', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      req.on('error', reject);
      req.end();
    });

    expect(response.status).toBe(404);
    expect(response.data).toBe('Not Found');
  });
});
