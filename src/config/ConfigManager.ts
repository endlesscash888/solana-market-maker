// /src/config/ConfigManager.ts
// Purpose: Manages and validates configuration from environment variables

import { Connection } from '@solana/web3.js';
import Redis from 'ioredis';
import * as dotenv from 'dotenv';
import { resolve } from 'node:path';

/**
 * Configuration interface for the bot
 */
export interface BotConfig {
  rpcUrl: string;
  redisUrl: string;
  connection: Connection;
  redisClient: Redis;
  logger: Console; // Simple console logger for now
}

/**
 * ConfigManager class to load and validate configuration
 */
export class ConfigManager {
  private config: BotConfig;

  constructor() {
    // Load environment variables
    dotenv.config({ path: resolve(process.cwd(), '.env') });
    this.config = this.loadAndValidateConfig();
  }

  /**
   * Load and validate configuration from environment
   * @returns Validated BotConfig object
   * @throws Error if validation fails
   */
  private loadAndValidateConfig(): BotConfig {
    const rpcUrl = process.env.RPC_URL;
    const redisUrl = process.env.REDIS_URL;

    if (!rpcUrl) throw new Error('RPC_URL is required in .env');
    if (!redisUrl) throw new Error('REDIS_URL is required in .env');

    const connection = new Connection(rpcUrl, 'confirmed');
    const redisClient = new Redis(redisUrl);
    const logger = console;

    return { rpcUrl, redisUrl, connection, redisClient, logger };
  }

  /**
   * Get the validated configuration
   * @returns BotConfig object
   */
  getConfig(): BotConfig {
    return this.config;
  }

  /**
   * Validate connection to Solana RPC
   */
  async validateConnection(): Promise<void> {
    const { connection } = this.config;
    const version = await connection.getVersion();
    console.log(\`✅ Connected to Solana RPC: \${version['solana-core']}\`);
  }

  /**
   * Validate Redis connection
   */
  async validateRedis(): Promise<void> {
    const { redisClient } = this.config;
    await redisClient.ping();
    console.log('✅ Connected to Redis');
  }
}
