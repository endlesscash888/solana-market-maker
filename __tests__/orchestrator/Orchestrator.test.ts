// __tests__/orchestrator/Orchestrator.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Orchestrator } from '../../src/orchestrator/Orchestrator.js';
import { Connection } from '@solana/web3.js';
import Redis from 'ioredis';

describe('Orchestrator', () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = {
      NODE_ENV: 'test',
      SOLANA_RPC_URL: 'https://api.mainnet-beta.solana.com',
      JITO_BLOCK_ENGINE_URL: 'https://mainnet.block-engine.jito.wtf',
      TARGET_TOKEN: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
      BASE_AMOUNT_SOL: '1.0',
      REDIS_URL: 'redis://localhost:6379',
    };
    orchestrator = new Orchestrator();
  });

  afterEach(() => {
    orchestrator.stop();
  });

  it('should initialize successfully', () => {
    expect(orchestrator).toBeInstanceOf(Orchestrator);
  });

  it('should start and stop trading loop', async () => {
    await orchestrator.start();
    expect(orchestrator['isRunning']).toBe(true);
    orchestrator.stop();
    expect(orchestrator['isRunning']).toBe(false);
  });

  it('should execute trade cycle and update metrics', async () => {
    vi.spyOn(orchestrator['orderRouter'], 'executeBuyOrder').mockResolvedValue({
      success: true,
      transactionId: 'mockTxId',
      executionTime: 100,
      slippageAchieved: 0.05,
    });
    await orchestrator.start();
    await new Promise(resolve => setTimeout(resolve, 100)); // Allow one cycle
    const report = orchestrator.getTradeReport();
    expect(report.successCount).toBeGreaterThan(0);
    expect(report.p99Latency).toBeGreaterThan(0);
  });
});
