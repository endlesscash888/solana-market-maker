// /src/config/BotConfig.ts
// Purpose: Type-safe, production-grade configuration management for Solana market-making bot
// Architecture: Clean configuration with Zod validation and dependency injection readiness

import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Core Solana network configuration schema
 * Validates RPC endpoints, timeouts, and connection parameters
 */
const SolanaConfigSchema = z.object({
  // Primary RPC endpoint for transactions
  rpcUrl: z.string().url('Invalid RPC URL format'),
  // WebSocket endpoint for real-time data
  wsUrl: z.string().url('Invalid WebSocket URL format'),
  // Connection timeout in milliseconds
  connectionTimeout: z.coerce.number().min(1000).max(30000).default(10000),
  // Maximum retry attempts for failed requests
  maxRetries: z.coerce.number().min(1).max(10).default(3),
  // Commitment level for transaction confirmation
  commitment: z.enum(['processed', 'confirmed', 'finalized']).default('confirmed'),
});

/**
 * Jito bundle configuration for priority execution
 * Essential for competitive market-making performance
 */
const JitoConfigSchema = z.object({
  // Jito Block Engine endpoint
  blockEngineUrl: z.string().url('Invalid Jito Block Engine URL'),
  // Tip amount in lamports for bundle priority
  tipLamports: z.coerce.number().min(1000).max(100000).default(10000),
  // Maximum bundle size (Jito limit is 5 transactions)
  maxBundleSize: z.coerce.number().min(1).max(5).default(4),
  // Bundle timeout in milliseconds
  bundleTimeout: z.coerce.number().min(5000).max(30000).default(15000),
});

/**
 * Trading strategy configuration
 * Controls market-making behavior and risk parameters
 */
const TradingConfigSchema = z.object({
  // Target token to market-make (Pump.fun token address)
  targetToken: z.string().min(32).max(44),
  // Base trading amount in SOL
  baseAmountSol: z.coerce.number().min(0.001).max(100),
  // Maximum slippage tolerance (percentage)
  maxSlippage: z.coerce.number().min(0.001).max(0.1).default(0.005), // 0.5%
  // Spread percentage for buy/sell orders
  spreadPercentage: z.coerce.number().min(0.001).max(0.05).default(0.01), // 1%
  // Rebalancing threshold (percentage portfolio imbalance)
  rebalanceThreshold: z.coerce.number().min(0.01).max(0.2).default(0.02), // 2%
  // Maximum position size as percentage of portfolio
  maxPositionSize: z.coerce.number().min(0.1).max(1.0).default(0.8), // 80%
});

/**
 * Redis caching and state management configuration
 * Critical for maintaining state across bot restarts
 */
const RedisConfigSchema = z.object({
  // Redis connection URL
  url: z.string().url('Invalid Redis URL'),
  // Key prefix for namespace isolation
  keyPrefix: z.string().min(1).default('solana_bot:'),
  // Default TTL for cached data in seconds
  defaultTtl: z.coerce.number().min(60).max(86400).default(3600), // 1 hour
  // Maximum retry attempts for Redis operations
  maxRetries: z.coerce.number().min(1).max(5).default(3),
  // Connection timeout in milliseconds
  connectTimeout: z.coerce.number().min(1000).max(10000).default(5000),
});

/**
 * Security and wallet configuration
 * Handles private keys and authentication
 */
const SecurityConfigSchema = z.object({
  // Bot wallet private key (base58 encoded)
  privateKey: z.string().min(32, 'Private key must be valid base58'),
  // Optional passphrase for additional security
  passphrase: z.string().optional(),
  // API keys for external services
  heliusApiKey: z.string().min(10).optional(),
  jupiterApiKey: z.string().optional(),
});

/**
 * Performance and monitoring configuration
 * Enables observability and performance tuning
 */
const PerformanceConfigSchema = z.object({
  // Enable performance metrics collection
  enableMetrics: z.coerce.boolean().default(true),
  // Metrics collection interval in milliseconds
  metricsInterval: z.coerce.number().min(1000).max(60000).default(5000),
  // Maximum memory usage threshold (MB)
  maxMemoryMb: z.coerce.number().min(256).max(8192).default(2048),
  // CPU usage alert threshold (percentage)
  cpuAlertThreshold: z.coerce.number().min(50).max(95).default(80),
  // Enable debug logging
  enableDebugLogs: z.coerce.boolean().default(false),
});

/**
 * Complete bot configuration schema
 * Combines all configuration sections with validation
 */
const BotConfigSchema = z.object({
  // Environment (development, staging, production)
  environment: z.enum(['development', 'staging', 'production']).default('development'),
  // Solana blockchain configuration
  solana: SolanaConfigSchema,
  // Jito bundle configuration
  jito: JitoConfigSchema,
  // Trading strategy parameters
  trading: TradingConfigSchema,
  // Redis state management
  redis: RedisConfigSchema,
  // Security and authentication
  security: SecurityConfigSchema,
  // Performance monitoring
  performance: PerformanceConfigSchema,
});

// Export configuration types for dependency injection
export type BotConfig = z.infer<typeof BotConfigSchema>;
export type SolanaConfig = z.infer<typeof SolanaConfigSchema>;
export type JitoConfig = z.infer<typeof JitoConfigSchema>;
export type TradingConfig = z.infer<typeof TradingConfigSchema>;
export type RedisConfig = z.infer<typeof RedisConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;
export type PerformanceConfig = z.infer<typeof PerformanceConfigSchema>;

/**
 * Configuration loader with comprehensive validation
 * Implements fail-fast principle for production reliability
 */
export class BotConfigManager {
  private static instance: BotConfigManager;
  private config: BotConfig;

  private constructor() {
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
   * Get specific configuration section
   * Provides type-safe access to configuration subsections
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
   * Implements comprehensive error handling and environment mapping
   */
  private loadAndValidateConfig(): BotConfig {
    try {
      // Map environment variables to configuration structure
      const rawConfig = {
        environment: process.env.NODE_ENV || 'development',
        solana: {
          rpcUrl: process.env.SOLANA_RPC_URL,
          wsUrl: process.env.SOLANA_WS_URL,
          connectionTimeout: process.env.SOLANA_CONNECTION_TIMEOUT,
          maxRetries: process.env.SOLANA_MAX_RETRIES,
          commitment: process.env.SOLANA_COMMITMENT,
        },
        jito: {
          blockEngineUrl: process.env.JITO_BLOCK_ENGINE_URL,
          tipLamports: process.env.JITO_TIP_LAMPORTS,
          maxBundleSize: process.env.JITO_MAX_BUNDLE_SIZE,
          bundleTimeout: process.env.JITO_BUNDLE_TIMEOUT,
        },
        trading: {
          targetToken: process.env.TARGET_TOKEN,
          baseAmountSol: process.env.BASE_AMOUNT_SOL,
          maxSlippage: process.env.MAX_SLIPPAGE,
          spreadPercentage: process.env.SPREAD_PERCENTAGE,
          rebalanceThreshold: process.env.REBALANCE_THRESHOLD,
          maxPositionSize: process.env.MAX_POSITION_SIZE,
        },
        redis: {
          url: process.env.REDIS_URL,
          keyPrefix: process.env.REDIS_KEY_PREFIX,
          defaultTtl: process.env.REDIS_DEFAULT_TTL,
          maxRetries: process.env.REDIS_MAX_RETRIES,
          connectTimeout: process.env.REDIS_CONNECT_TIMEOUT,
        },
        security: {
          privateKey: process.env.BOT_PRIVATE_KEY,
          passphrase: process.env.BOT_PASSPHRASE,
          heliusApiKey: process.env.HELIUS_API_KEY,
          jupiterApiKey: process.env.JUPITER_API_KEY,
        },
        performance: {
          enableMetrics: process.env.ENABLE_METRICS,
          metricsInterval: process.env.METRICS_INTERVAL,
          maxMemoryMb: process.env.MAX_MEMORY_MB,
          cpuAlertThreshold: process.env.CPU_ALERT_THRESHOLD,
          enableDebugLogs: process.env.ENABLE_DEBUG_LOGS,
        },
      };

      // Validate configuration against schema
      const validatedConfig = BotConfigSchema.parse(rawConfig);
      
      // Additional business logic validation
      this.validateBusinessRules(validatedConfig);
      
      console.log('✅ Configuration loaded and validated successfully');
      console.log(`📊 Environment: ${validatedConfig.environment}`);
      console.log(`🎯 Target Token: ${validatedConfig.trading.targetToken.slice(0, 8)}...`);
      
      return validatedConfig;
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Format Zod validation errors for production debugging
        const errorMessages = error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        ).join('\n');
        
        console.error('❌ Configuration validation failed:');
        console.error(errorMessages);
        throw new Error(`Invalid configuration: ${errorMessages}`);
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
    // Ensure spread is larger than slippage to prevent immediate losses
    if (config.trading.spreadPercentage <= config.trading.maxSlippage) {
      throw new Error('Spread percentage must be greater than max slippage');
    }

    // Validate rebalance threshold makes economic sense
    if (config.trading.rebalanceThreshold >= config.trading.maxPositionSize) {
      throw new Error('Rebalance threshold must be less than max position size');
    }

    // Ensure tip amount is economically viable
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
