// __tests__/config/ConfigManager.test.ts
import { describe, it, expect, vi } from 'vitest';
import { ConfigManager, BotConfig } from '../../src/config/ConfigManager.js';
import { Connection } from '@solana/web3.js';
import Redis from 'ioredis';

describe('ConfigManager', () => {
  it('should load and validate configuration successfully', () => {
    // Mock environment variables
    process.env.RPC_URL = 'https://api.mainnet-beta.solana.com';
    process.env.REDIS_URL = 'redis://localhost:6379';

    const manager = new ConfigManager();
    const config = manager.getConfig();

    expect(config).toBeDefined();
    expect(config.rpcUrl).toBe('https://api.mainnet-beta.solana.com');
    expect(config.redisUrl).toBe('redis://localhost:6379');
    expect(config.connection).toBeInstanceOf(Connection);
    expect(config.redisClient).toBeInstanceOf(Redis);
    expect(config.logger).toBe(console);
  });
});
