// __tests__/engine/OrderRouter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderRouter } from '../../src/engine/OrderRouter.js';
import { Connection } from '@solana/web3.js';
import Redis from 'ioredis';
import { PumpFunAdapter } from '../../src/adapters/PumpFunAdapter.js';

describe('OrderRouter', () => {
  let router: OrderRouter;
  const mockRedis = new Redis();
  const mockConnection = new Connection('http://localhost:8899');
  const mockPumpAdapter = new PumpFunAdapter(mockRedis, console, mockConnection);

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.JITO_BLOCK_ENGINE_URL = 'http://localhost:8899';
    process.env.SOLANA_RPC_URL = 'http://localhost:8899';

    router = new OrderRouter(
      {
        redisClient: mockRedis,
        solanaConnection: mockConnection,
        pumpFunAdapter: mockPumpAdapter,
        jitoTipAccount: {} as JitoTipAccount,
        circuitBreakerThreshold: 3,
        circuitBreakerTimeout: 30000,
        tipLamports: 10000,
        maxRetries: 2,
        bundleTimeout: 5000,
      },
      mockPumpAdapter,
      mockConnection,
      mockRedis
    );
  });

  it('should initialize with Jito provider', () => {
    expect(router).toBeInstanceOf(OrderRouter);
  });

  it('should calculate dynamic tips based on volatility', () => {
    const tip = (router as any).calculateDynamicTip(1.5);
    expect(tip).toBeGreaterThan(0);
  });

  it('should execute a buy order successfully', async () => {
    vi.spyOn(mockPumpAdapter, 'createBuyTransaction').mockResolvedValue(new Transaction());
    const result = await router.executeOrder({
      type: 'buy',
      tokenAddress: 'TokenAddress123',
      amountLamports: 1_500_000_000, // 1.5 SOL
      maxSlippageBps: 50,
      volatilityFactor: 1.5,
    });
    expect(result.success).toBe(true);
    expect(result.executionTime).toBeGreaterThan(0);
    expect(result.bundleMetrics?.tipAmount).toBeGreaterThan(0);
  });
});
