// __tests__/config/BotConfig.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BotConfigManager, type BotConfig } from '../../src/config/BotConfig.js';

describe('BotConfigManager', () => {
  beforeEach(() => {
    // Reset singleton instance for each test
    (BotConfigManager as any).instance = undefined;
    
    // Mock environment variables
    vi.resetModules();
    process.env = {
      NODE_ENV: 'test',
      SOLANA_RPC_URL: 'https://api.mainnet-beta.solana.com',
      SOLANA_WS_URL: 'wss://api.mainnet-beta.solana.com',
      JITO_BLOCK_ENGINE_URL: 'https://mainnet.block-engine.jito.wtf',
      TARGET_TOKEN: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
      BASE_AMOUNT_SOL: '1.0',
      REDIS_URL: 'redis://localhost:6379',
      BOT_PRIVATE_KEY: 'test_private_key_base58_encoded_12345678',
    };
  });

  it('should create singleton instance successfully', () => {
    const instance1 = BotConfigManager.getInstance();
    const instance2 = BotConfigManager.getInstance();
    
    expect(instance1).toBe(instance2);
    expect(instance1).toBeInstanceOf(BotConfigManager);
  });

  it('should validate and load configuration correctly', () => {
    const configManager = BotConfigManager.getInstance();
    const config = configManager.getConfig();
    
    expect(config.environment).toBe('test');
    expect(config.solana.rpcUrl).toBe('https://api.mainnet-beta.solana.com');
    expect(config.trading.targetToken).toBe('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    expect(config.trading.baseAmountSol).toBe(1.0);
  });

  it('should provide type-safe configuration sections', () => {
    const configManager = BotConfigManager.getInstance();
    
    const solanaConfig = configManager.getSolanaConfig();
    const tradingConfig = configManager.getTradingConfig();
    
    expect(solanaConfig.rpcUrl).toBeDefined();
    expect(tradingConfig.targetToken).toBeDefined();
    expect(typeof tradingConfig.baseAmountSol).toBe('number');
  });

  it('should enforce business rules validation', () => {
    process.env.SPREAD_PERCENTAGE = '0.001';  // 0.1%
    process.env.MAX_SLIPPAGE = '0.005';       // 0.5%
    
    expect(() => {
      BotConfigManager.getInstance();
    }).toThrow('Spread percentage must be greater than max slippage');
  });
});
