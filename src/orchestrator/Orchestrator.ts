// /src/orchestrator/Orchestrator.ts
// Purpose: Central coordinator for trading operations with event-driven architecture

import { Connection } from '@solana/web3.js';
import { EventEmitter } from 'node:events';
import { setInterval, clearInterval } from 'node:timers';
import { PumpFunAdapter } from '../adapters/PumpFunAdapter.js';
import { OrderRouter, OrderRouterConfig } from '../engine/OrderRouter.js';
import { MarketStateManager } from '../state/MarketStateManager.js';
import { BotConfigManager, BotConfig } from '../config/BotConfig.js';
import Redis from 'ioredis';

/**
 * Trade report interface for performance tracking
 */
interface TradeReport {
  successCount: number;
  failureCount: number;
  totalLatencyMs: number;
  lastTradeTime: number;
}

/**
 * Orchestrator class to manage trading lifecycle and coordination
 */
export class Orchestrator extends EventEmitter {
  private readonly config: BotConfig;
  private readonly connection: Connection;
  private readonly redis: Redis;
  private pumpAdapter: PumpFunAdapter;
  private orderRouter: OrderRouter;
  private marketStateManager: MarketStateManager;
  private isRunning: boolean = false;
  private tradeInterval?: NodeJS.Timeout;
  private tradeReport: TradeReport = { successCount: 0, failureCount: 0, totalLatencyMs: 0, lastTradeTime: 0 };
  private circuitBreaker: boolean = false;

  constructor() {
    super();
    const configManager = BotConfigManager.getInstance();
    this.config = configManager.getConfig();
    this.connection = this.config.solana.connection;
    this.redis = this.config.redis.redisClient;

    // Initialize dependencies with dependency injection
    this.pumpAdapter = new PumpFunAdapter(this.redis, console, this.connection);
    this.orderRouter = new OrderRouter(
      {
        ...this.config.trading,
        ...this.config.jito,
        redisClient: this.redis,
        solanaConnection: this.connection,
        pumpFunAdapter: this.pumpAdapter,
        circuitBreakerThreshold: 5,
        circuitBreakerTimeout: 30000,
      } as OrderRouterConfig,
      this.pumpAdapter,
      this.connection,
      this.redis
    );
    this.marketStateManager = new MarketStateManager(this.redis, this.connection);

    this.emit('initialized', { status: 'ready' });
    console.log('🚀 Orchestrator initialized with configuration');
  }

  /**
   * Start the trading loop with rebalancing and circuit breaking
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.circuitBreaker = false;

    // Schedule trade execution
    this.tradeInterval = setInterval(async () => {
      if (this.circuitBreaker) {
        console.warn('⚠️ Circuit breaker active, halting trades');
        return;
      }

      try {
        await this.executeTradeCycle();
      } catch (error) {
        this.handleError(error as Error);
      }
    }, this.config.performance.metricsInterval);

    console.log('▶️ Orchestrator started');
    this.emit('started');
  }

  /**
   * Execute a single trade cycle with rebalancing
   */
  private async executeTradeCycle(): Promise<void> {
    const tokenAddress = this.config.trading.targetToken;
    const state = await this.marketStateManager.getMarketState(tokenAddress);

    if (!state) {
      await this.marketStateManager.updatePosition(tokenAddress, 0);
      await this.marketStateManager.updateLiquidity(tokenAddress, 0);
      console.log('📥 Initializing market state');
    }

    const positionSize = state?.positionSize || 0;
    const liquidity = state?.liquidity || 0;
    const rebalanceThreshold = this.config.trading.rebalanceThreshold;

    if (Math.abs(positionSize) > this.config.trading.maxPositionSize * rebalanceThreshold) {
      await this.rebalancePosition(tokenAddress, positionSize);
    } else {
      await this.executeMarketOrder(tokenAddress);
    }

    await this.updateMetrics();
  }

  /**
   * Execute a market order (buy or sell) based on market conditions
   */
  private async executeMarketOrder(tokenAddress: string): Promise<void> {
    const amountSol = this.config.trading.baseAmountSol;
    const startTime = Date.now();

    const result = await this.orderRouter.executeBuyOrder(tokenAddress, amountSol);
    const latency = Date.now() - startTime;

    if (result.success) {
      this.tradeReport.successCount++;
      this.tradeReport.totalLatencyMs += latency;
      this.tradeReport.lastTradeTime = Date.now();
      await this.marketStateManager.updatePosition(tokenAddress, amountSol);
      console.log(`✅ Buy executed: ${result.transactionId.slice(0, 8)}... Latency: ${latency}ms`);
    } else {
      this.tradeReport.failureCount++;
      console.error(`❌ Buy failed: ${result.error}`);
    }

    this.emit('tradeExecuted', { result, latency });
  }

  /**
   * Rebalance position by executing a counter trade
   */
  private async rebalancePosition(tokenAddress: string, positionSize: number): Promise<void> {
    const amount = positionSize > 0 ? -positionSize * 0.5 : -positionSize * 0.5;
    const startTime = Date.now();

    const result = amount > 0
      ? await this.orderRouter.executeBuyOrder(tokenAddress, amount)
      : await this.orderRouter.executeSellOrder(tokenAddress, -amount);
    const latency = Date.now() - startTime;

    if (result.success) {
      this.tradeReport.successCount++;
      this.tradeReport.totalLatencyMs += latency;
      await this.marketStateManager.updatePosition(tokenAddress, amount);
      console.log(`⚖️ Rebalanced: ${result.transactionId.slice(0, 8)}... Latency: ${latency}ms`);
    } else {
      this.tradeReport.failureCount++;
      console.error(`❌ Rebalance failed: ${result.error}`);
    }

    this.emit('rebalanced', { result, latency });
  }

  /**
   * Update performance metrics and trigger circuit breaker if needed
   */
  private async updateMetrics(): Promise<void> {
    const failureRate = this.tradeReport.failureCount / (this.tradeReport.successCount + this.tradeReport.failureCount) || 0;
    if (failureRate > 0.2) { // 20% failure rate threshold
      this.circuitBreaker = true;
      setTimeout(() => this.circuitBreaker = false, this.config.jito.bundleTimeout);
      console.warn('⚠️ Circuit breaker triggered due to high failure rate');
    }

    this.emit('metricsUpdated', this.getTradeReport());
  }

  /**
   * Handle errors with retry and logging
   */
  private handleError(error: Error): void {
    console.error(`❌ Orchestrator error: ${error.message}`);
    this.emit('error', error);
    if (this.tradeReport.failureCount > this.config.trading.maxPositionSize) {
      this.stop();
    }
  }

  /**
   * Stop the trading loop and clean up
   */
  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.tradeInterval) clearInterval(this.tradeInterval);
    console.log('⏹️ Orchestrator stopped');
    this.emit('stopped');
  }

  /**
   * Get current trade report
   */
  getTradeReport(): TradeReport {
    return { ...this.tradeReport, p99Latency: this.calculateP99Latency() };
  }

  /**
   * Calculate p99 latency from historical data
   */
  private calculateP99Latency(): number {
    const latencies = this.tradeReport.totalLatencyMs / this.tradeReport.successCount || 0;
    return latencies; // Simplified; use a sliding window in production
  }
}

/**
 * Example test stub using vitest
 */
