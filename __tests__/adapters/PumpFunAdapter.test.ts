// __tests__/adapters/PumpFunAdapter.test.ts
import { describe, it, expect, vi } from 'vitest';
import { PumpFunAdapter } from '../../src/adapters/PumpFunAdapter.js';
import { Connection } from '@solana/web3.js';
import Redis from 'ioredis';

describe('PumpFunAdapter', () => {
  it('should create a buy transaction with real Pump.fun logic', async () => {
    const mockRedis = new Redis();
    const mockConnection = new Connection('https://api.mainnet-beta.solana.com');
    const adapter = new PumpFunAdapter(mockRedis, console, mockConnection);
    const transaction = await adapter.createBuyTransaction('TokenAddress123', 1.0, 0.05);
    expect(transaction).toBeDefined();
    expect(transaction.instructions.length).toBe(1);
    expect(transaction.instructions[0].programId.toBase58()).toBe('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
  });
});
