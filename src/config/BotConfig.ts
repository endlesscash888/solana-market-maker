// /src/config/BotConfig.ts
// Purpose: Centralized, type-safe configuration management with validation

import { z } from 'zod';
import { Connection } from '@solana/web3.js';
import Redis from 'ioredis';
import * as dotenv from 'dotenv';
import { resolve } from 'node:path';

/**
 * Schema definitions for each configuration section
 */
const SolanaConfigSchema = z.object({
  rpcUrl: z.string().url().min(1, 'RPC URL is required'),
  wsUrl: z.string().url().optional(),
  connectionTimeout: z.number().int().positive().default(60000),
  maxRetries: z.number().int().nonnegative().default(5),
  commitment: z.enum(['processed', 'confirmed', 'finalized']).default('confirmed'),
});

const JitoConfigSchema = z.object({
  blockEngineUrl: z.string().url().min(1, 'Jito block engine URL is required'),
  tipLamports: z.number().int().positive().default(100000), // 0.0001 SOL default tip
  maxBundleSize: z.number().int().positive().default(10),
  bundleTimeout: z.number().int().positive().default(5000),
});

const TradingConfigSchema = z.object({
  targetToken: z.string().min(1, 'Target token is required'),
  baseAmountSol: z.number().positive().default(1.0),
  maxSlippage: z.number().min(0).max(0.1).default(0.005), // 0.5% default
  spreadPercentage: z.number().min(0).max(0.1).default(0.01), // 1% default
  rebalanceThreshold: z.number().positive().default(0.1),
  maxPositionSize: z.number().positive().default(100),
});

const RedisConfigSchema = z.object({
  url: z.string().min(1, 'Redis URL is required'),
  keyPrefix: z.string().default('mmbot:'),
  defaultTtl: z.number().int().nonnegative().default(3600), // 1 hour default
  maxRetries: z.number().int().nonnegative().default(3),
  connectTimeout: z.number().int().positive().default(30000),
});

const SecurityConfigSchema = z.object({
  privateKey: z.string().min(1, 'Private key is required'),
  passphrase: z.string().optional(),
  heliusApiKey: z.string().optional(),
  jupiterApiKey: z.string().optional(),
});

const PerformanceConfigSchema = z.object({
  enableMetrics: z.boolean().default(false),
  metricsInterval: z.number().int().positive().default(60000), // 1 minute default
  maxMemoryMb: z.number().int().positive().default(1024),
  cpuAlertThreshold: z.number().min(0).max(100).default(80), // 80% CPU threshold
  enableDebugLogs: z.boolean().default(false),
});

/**
 * Combined configuration schema
 */
const BotConfigSchema = z.object({
  environment: z.enum(['development', 'test', 'production']).default('development'),
  solana: SolanaConfigSchema,
  jito: JitoConfigSchema,
  trading: TradingConfigSchema,
  redis: RedisConfigSchema,
  security: SecurityConfigSchema,
  performance: PerformanceConfigSchema,
});

/**
 * Inferred types from schemas
 */
export type SolanaConfig = z.infer<typeof SolanaConfigSchema>;
export type JitoConfig = z.infer<typeof JitoConfigSchema>;
export type TradingConfig = z.infer<typeof TradingConfigSchema>;
export type RedisConfig = z.infer<typeof RedisConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;
export type PerformanceConfig = z.infer<typeof PerformanceConfigSchema>;
export type BotConfig = z.infer<typeof BotConfigSchema>;

/**
 * Configuration loader with comprehensive validation
 * Implements fail-fast principle for production reliability
 */
export class BotConfigManager {
  private static instance: BotConfigManager;
  private config: BotConfig;

  private constructor() {
    // Load environment variables
    dotenv.config({ path: resolve(process.cwd(), '.env') });
    this.config = this.loadAndValidateConfig();
  }

  /**
   * Singleton pattern for consistent configuration access
   * Ensures single source of truth across the application
   */
  public static getInstance(): BotConfigManager {
    if (!BotConfigManager.instance) {
      BotConfigManager.instance = new BotConfigManager();
    }
    return BotConfigManager.instance;
  }

  /**
   * Get the complete validated configuration
   */
  public getConfig(): BotConfig {
    return this.config;
  }

  /**
   * Get specific configuration sections
   */
  public getSolanaConfig(): SolanaConfig {
    return this.config.solana;
  }

  public getJitoConfig(): JitoConfig {
    return this.config.jito;
  }

  public getTradingConfig(): TradingConfig {
    return this.config.trading;
  }

  public getRedisConfig(): RedisConfig {
    return this.config.redis;
  }

  public getSecurityConfig(): SecurityConfig {
    return this.config.security;
  }

  public getPerformanceConfig(): PerformanceConfig {
    return this.config.performance;
  }

  /**
   * Core configuration loading and validation logic
   */
  private loadAndValidateConfig(): BotConfig {
    try {
      // Map environment variables to configuration structure
      const rawConfig = {
        environment: process.env.NODE_ENV || 'development',
        solana: {
          rpcUrl: process.env.SOLANA_RPC_URL,
          wsUrl: process.env.SOLANA_WS_URL,
          connectionTimeout: parseInt(process.env.SOLANA_CONNECTION_TIMEOUT || '60000'),
          maxRetries: parseInt(process.env.SOLANA_MAX_RETRIES || '5'),
          commitment: process.env.SOLANA_COMMITMENT || 'confirmed',
        },
        jito: {
          blockEngineUrl: process.env.JITO_BLOCK_ENGINE_URL,
          tipLamports: parseInt(process.env.JITO_TIP_LAMPORTS || '100000'),
          maxBundleSize: parseInt(process.env.JITO_MAX_BUNDLE_SIZE || '10'),
          bundleTimeout: parseInt(process.env.JITO_BUNDLE_TIMEOUT || '5000'),
        },
        trading: {
          targetToken: process.env.TARGET_TOKEN || '',
          baseAmountSol: parseFloat(process.env.BASE_AMOUNT_SOL || '1.0'),
          maxSlippage: parseFloat(process.env.MAX_SLIPPAGE || '0.005'),
          spreadPercentage: parseFloat(process.env.SPREAD_PERCENTAGE || '0.01'),
          rebalanceThreshold: parseFloat(process.env.REBALANCE_THRESHOLD || '0.1'),
          maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '100'),
        },
        redis: {
          url: process.env.REDIS_URL || '',
          keyPrefix: process.env.REDIS_KEY_PREFIX || 'mmbot:',
          defaultTtl: parseInt(process.env.REDIS_DEFAULT_TTL || '3600'),
          maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
          connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '30000'),
        },
        security: {
          privateKey: process.env.BOT_PRIVATE_KEY || '',
          passphrase: process.env.BOT_PASSPHRASE,
          heliusApiKey: process.env.HELIUS_API_KEY,
          jupiterApiKey: process.env.JUPITER_API_KEY,
        },
        performance: {
          enableMetrics: process.env.ENABLE_METRICS === 'true',
          metricsInterval: parseInt(process.env.METRICS_INTERVAL || '60000'),
          maxMemoryMb: parseInt(process.env.MAX_MEMORY_MB || '1024'),
          cpuAlertThreshold: parseInt(process.env.CPU_ALERT_THRESHOLD || '80'),
          enableDebugLogs: process.env.ENABLE_DEBUG_LOGS === 'true',
        },
      };

      // Validate configuration against schema
      const validatedConfig = BotConfigSchema.parse(rawConfig);

      // Additional business logic validation
      this.validateBusinessRules(validatedConfig);

      console.log('✅ Configuration loaded and validated successfully');
      console.log(\`📊 Environment: \${validatedConfig.environment}\`);
      console.log(\`🎯 Target Token: \${validatedConfig.trading.targetToken.slice(0, 8)}...\`);

      return validatedConfig;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => \`\${err.path.join('.')}: \${err.message}\`).join('\n');
        console.error('❌ Configuration validation failed:');
        console.error(errorMessages);
        throw new Error(\`Invalid configuration: \${errorMessages}\`);
      }
      console.error('❌ Configuration loading failed:', error);
      throw error;
    }
  }

  /**
   * Additional business rule validation
   * Ensures configuration values make sense in trading context
   */
  private validateBusinessRules(config: BotConfig): void {
    // Ensure spread is greater than slippage to prevent immediate losses
    if (config.trading.spreadPercentage <= config.trading.maxSlippage) {
      throw new Error('Spread percentage must be greater than max slippage');
    }

    // Ensure rebalance threshold is less than max position size
    if (config.trading.rebalanceThreshold >= config.trading.maxPositionSize) {
      throw new Error('Rebalance threshold must be less than max position size');
    }

    // Warn if Jito tip is >10% of base trading amount
    if (config.jito.tipLamports > config.trading.baseAmountSol * 1000000 * 0.1) {
      console.warn('⚠️ Jito tip amount is >10% of base trading amount');
    }
  }

  /**
   * Reload configuration for runtime updates
   * Useful for configuration changes without restart
   */
  public reloadConfig(): void {
    dotenv.config();
    this.config = this.loadAndValidateConfig();
    console.log('🔄 Configuration reloaded successfully');
  }
}

// Export singleton instance for easy access
export const botConfig = BotConfigManager.getInstance();
