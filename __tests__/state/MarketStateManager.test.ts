// __tests__/state/MarketStateManager.test.ts
import { describe, it, expect } from 'vitest';
import { MarketStateManager } from '../../src/state/MarketStateManager.js';
import { Connection } from '@solana/web3.js';

describe('MarketStateManager', () => {
  it('should update and retrieve market state', async () => {
    const mockRedis = new Redis();
    const mockConnection = new Connection('https://api.mainnet-beta.solana.com');
    const manager = new MarketStateManager(mockRedis, mockConnection);
    await manager.updatePosition('TokenAddress123', 10);
    await manager.updateLiquidity('TokenAddress123', 50);
    await manager.refreshVolatility('TokenAddress123');
    const state = await manager.getMarketState('TokenAddress123');
    expect(state).toBeDefined();
    expect(state?.positionSize).toBe(10);
    expect(state?.liquidity).toBe(50);
    expect(state?.volatility).toBeGreaterThan(0); // Depends on mock implementation
  });
});
