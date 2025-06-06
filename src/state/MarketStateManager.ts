// /src/state/MarketStateManager.ts
// Purpose: Manages and caches market state (positions, liquidity, volatility) in Redis

import { Connection } from '@solana/web3.js';
import Redis from 'ioredis';
import { calculateVolatility } from '../utils/marketAnalysis.js'; // Assume this exists

/**
 * Market state interface representing cached data
 */
interface MarketState {
  tokenAddress: string;
  positionSize: number;
  liquidity: number;
  volatility: number;
  lastUpdated: number;
}

/**
 * MarketStateManager class for state management and caching
 */
export class MarketStateManager {
  private readonly redis: Redis;
  private readonly connection: Connection;
  private readonly cachePrefix: string = 'market:';

  constructor(redis: Redis, connection: Connection) {
    // Validate dependencies
    if (!redis) throw new Error('Redis client is required');
    this.redis = redis;
    this.connection = connection;
    console.log('📦 MarketStateManager initialized');
  }

  /**
   * Update position size for a token in Redis
   * @param tokenAddress Target token
   * @param amount Change in position size
   */
  async updatePosition(tokenAddress: string, amount: number): Promise<void> {
    const key = `${this.cachePrefix}\${tokenAddress}`;
    await this.redis.hincrbyfloat(key, 'positionSize', amount);
    await this.redis.hset(key, 'lastUpdated', Date.now().toString());
    console.log(`📊 Position updated for \${tokenAddress}: \${amount}`);
  }

  /**
   * Update liquidity for a token in Redis
   * @param tokenAddress Target token
   * @param amount Change in liquidity
   */
  async updateLiquidity(tokenAddress: string, amount: number): Promise<void> {
    const key = `${this.cachePrefix}\${tokenAddress}`;
    await this.redis.hincrbyfloat(key, 'liquidity', amount);
    await this.redis.hset(key, 'lastUpdated', Date.now().toString());
    console.log(`📊 Liquidity updated for \${tokenAddress}: \${amount}`);
  }

  /**
   * Refresh volatility and cache it
   * @param tokenAddress Target token
   */
  async refreshVolatility(tokenAddress: string): Promise<void> {
    const volatility = await calculateVolatility(tokenAddress, this.connection);
    const key = `${this.cachePrefix}\${tokenAddress}`;
    await this.redis.hset(key, 'volatility', volatility.toString());
    await this.redis.hset(key, 'lastUpdated', Date.now().toString());
    console.log(`📈 Volatility refreshed for \${tokenAddress}: \${volatility}`);
  }

  /**
   * Get current market state for a token
   * @param tokenAddress Target token
   * @returns MarketState or null if not found
   */
  async getMarketState(tokenAddress: string): Promise<MarketState | null> {
    const key = `${this.cachePrefix}\${tokenAddress}`;
    const state = await this.redis.hgetall(key);
    if (Object.keys(state).length === 0) return null;
    return {
      tokenAddress,
      positionSize: parseFloat(state.positionSize || '0'),
      liquidity: parseFloat(state.liquidity || '0'),
      volatility: parseFloat(state.volatility || '0'),
      lastUpdated: parseInt(state.lastUpdated || '0')
    };
  }
}
