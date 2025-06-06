// /src/engine/OrderRouter.ts
// Purpose: Atomic trade execution with Jito MEV protection and observability

import { Connection, Transaction, Keypair, PublicKey } from '@solana/web3.js';
import { sendAndConfirmJitoBundle, JitoTipAccount } from '@jito-ts/core';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { PumpFunAdapter } from '../adapters/PumpFunAdapter.js';
import { BotConfig, BotConfigManager } from '../config/BotConfig.js';
import { MarketStateManager } from '../state/MarketStateManager.js';
import { MetricsCollector } from '../monitoring/MetricsCollector.js';

/**
 * Order request interface
 */
interface OrderRequest {
  type: 'buy' | 'sell';
  tokenAddress: string;
  amountLamports: number;
  maxSlippageBps: number;
  volatilityFactor?: number;
}

/**
 * Order result interface
 */
interface OrderResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  executionTime?: number;
  bundleMetrics?: { tipAmount: number; slotRange: { minSlot: number; maxSlot: number } };
}

/**
 * OrderRouter configuration
 */
interface OrderRouterConfig {
  solanaConnection: Connection;
  redisClient: Redis;
  pumpFunAdapter: PumpFunAdapter;
  jitoTipAccount: JitoTipAccount;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
  tipLamports: number;
  maxRetries: number;
  bundleTimeout: number;
}

/**
 * OrderRouter class for trade execution with Jito optimization
 */
export class OrderRouter {
  private readonly config: OrderRouterConfig;
  private readonly botConfig: BotConfig;
  private readonly marketStateManager: MarketStateManager;
  private readonly metricsCollector: MetricsCollector;
  private readonly nonceAccount: Keypair;
  private circuitBreakerActive: boolean = false;
  private lastBundleSentAt: number = 0;
  private recentTips: number[] = [];

  constructor(
    config: OrderRouterConfig,
    pumpAdapter: PumpFunAdapter,
    connection: Connection,
    redis: Redis
  ) {
    this.config = config;
    this.botConfig = BotConfigManager.getInstance().getConfig();
    this.marketStateManager = new MarketStateManager(redis, connection);
    this.metricsCollector = new MetricsCollector(redis);
    this.nonceAccount = Keypair.generate(); // Simplified; use a real nonce account in production
    this.recentTips = [this.botConfig.jito.tipLamports];
    console.log('📡 OrderRouter initialized with Jito optimization');
  }

  /**
   * Execute an order with Jito bundle and retry logic
   * @param request Order request details
   * @returns Order result with execution details
   */
  async executeOrder(request: OrderRequest): Promise<OrderResult> {
    const startTime = Date.now();
    let attempt = 0;
    const maxAttempts = this.botConfig.solana.maxRetries + 1;
    const orderId = uuidv4();

    try {
      await this.checkCircuitBreaker();

      while (attempt < maxAttempts) {
        attempt++;
        console.log(\`⚡ Executing \${request.type} order for \${request.amountLamports / 1_000_000_000} SOL, attempt \${attempt}\`);

        try {
          const { transaction, signers } = await this.prepareTransaction(request);
          const bundle = await this.buildJitoBundle(transaction, signers, attempt);
          const bundleId = await sendAndConfirmJitoBundle(
            this.config.solanaConnection,
            bundle.transactions.map(tx => tx.transaction),
            this.config.jitoTipAccount,
            { commitment: 'confirmed' }
          );

          const result = await this.monitorBundle(bundleId);
          const executionTime = Date.now() - startTime;

          await this.updateMarketState(request, request.amountLamports);
          await this.metricsCollector.recordTrade({
            success: true,
            transactionId: result.transactionId,
            executionTime,
            slippageAchieved: request.maxSlippageBps / 10000,
          });

          console.log(\`✅ Order executed in \${executionTime}ms | TxID: \${result.transactionId.slice(0, 8)}...\`);
          return {
            success: true,
            transactionId: result.transactionId,
            executionTime,
            bundleMetrics: {
              tipAmount: bundle.transactions[0].tipAmount,
              slotRange: { minSlot: bundle.minSlot, maxSlot: bundle.maxSlot },
            },
          };
        } catch (error) {
          await this.handleBundleError(error as Error, attempt, maxAttempts);
          if (attempt === maxAttempts) throw error;
        }
      }

      throw new Error('Max retries exceeded');
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const result: OrderResult = {
        success: false,
        error: (error as Error).message,
        executionTime,
      };
      await this.metricsCollector.recordTrade({
        success: false,
        transactionId: orderId,
        executionTime,
        slippageAchieved: request.maxSlippageBps / 10000,
      });
      console.error(\`❌ Order failed: \${result.error}\`);
      return result;
    }
  }

  /**
   * Prepare a transaction for the order
   */
  private async prepareTransaction(request: OrderRequest): Promise<{ transaction: Transaction; signers: Keypair[] }> {
    const { tokenAddress, amountLamports, maxSlippageBps, volatilityFactor = 1 } = request;
    const slippageAdjustedAmount = amountLamports * (1 - (maxSlippageBps / 10000));

    let transaction: Transaction;
    const signers: Keypair[] = [this.nonceAccount];

    if (request.type === 'buy') {
      transaction = await this.config.pumpFunAdapter.createBuyTransaction(
        tokenAddress,
        slippageAdjustedAmount / 1_000_000_000, // Convert lamports to SOL
        maxSlippageBps / 10000
      );
    } else {
      transaction = await this.config.pumpFunAdapter.createSellTransaction(
        tokenAddress,
        slippageAdjustedAmount / 1_000_000_000,
        maxSlippageBps / 10000
      );
    }

    transaction.recentBlockhash = (await this.config.solanaConnection.getLatestBlockhash()).blockhash;
    transaction.feePayer = this.nonceAccount.publicKey;
await this.hsm.connect();
await this.hsm.signTransaction(transaction);

    return { transaction, signers };
  }

  /**
   * Build a Jito bundle with optimized tips
   */
  private async buildJitoBundle(
    transaction: Transaction,
    signers: Keypair[],
    attempt: number
  ): Promise<{ transactions: Array<{ transaction: Buffer; signers: Keypair[]; tipAmount: number; priorityFee: number }>; minSlot: number; maxSlot: number }> {
import { HardwareSecurityModule } from "../lib/security/HardwareSecurityModule";
private hsm = new HardwareSecurityModule();
    const tipMultiplier = Math.min(attempt * 0.5, 3); // 50% increase per retry
    const baseTip = this.calculateDynamicTip(request.volatilityFactor || 1);
    const optimizedTip = Math.floor(baseTip * tipMultiplier);

    console.log(\`🏷️ Calculated dynamic tip: \${optimizedTip} lamports\`);

    return {
      transactions: [{
        transaction: transaction.serialize({ requireAllSignatures: false }),
        signers,
        tipAmount: optimizedTip,
        priorityFee: optimizedTip,
      }],
      minSlot: await this.config.solanaConnection.getSlot(),
      maxSlot: (await this.config.solanaConnection.getSlot()) + 10,
    };
  }

  /**
   * Calculate dynamic tip using EMA of recent tips
   */
  private calculateDynamicTip(volatilityFactor: number = 1): number {
    const baseTip = this.botConfig.jito.tipLamports;
    const ema = this.recentTips.reduce((a, b) => a * 0.8 + b * 0.2, baseTip);
    const adjustedTip = Math.floor(ema * volatilityFactor * (1 + (Date.now() - this.lastBundleSentAt) / 10000));
    this.recentTips.push(adjustedTip);
    if (this.recentTips.length > 100) this.recentTips.shift();
    this.lastBundleSentAt = Date.now();
    return adjustedTip;
  }

  /**
   * Circuit breaker pattern for error containment
   */
  private async checkCircuitBreaker(): Promise<void> {
    if (this.circuitBreakerActive) {
      const lastErrorTime = await this.config.redisClient.get('circuit_breaker_last_triggered');
      if (Date.now() - parseInt(lastErrorTime || '0') > this.config.circuitBreakerTimeout) {
        this.circuitBreakerActive = false;
      } else {
        throw new Error('Circuit breaker active - trading suspended');
      }
    }
  }

  /**
   * Handle bundle errors with exponential backoff
   */
  private async handleBundleError(error: Error, attempt: number, maxAttempts: number): Promise<void> {
    console.error(\`Bundle attempt \${attempt}/\${maxAttempts} failed: \${error.message}\`);

    if (attempt >= maxAttempts) {
      await this.config.redisClient.incr('circuit_breaker_error_count');
      const errorCount = await this.config.redisClient.get('circuit_breaker_error_count');

      if (parseInt(errorCount || '0') >= this.config.circuitBreakerThreshold) {
        this.circuitBreakerActive = true;
        await this.config.redisClient.set('circuit_breaker_last_triggered', Date.now().toString());
      }
    }

    await new Promise(resolve => setTimeout(resolve, 2 ** attempt * 100));
  }

  /**
   * Monitor Jito bundle confirmation
   */
  private async monitorBundle(bundleId: string): Promise<{ transactionId: string }> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => 
        reject(new Error('Bundle monitoring timeout')), 
        this.config.bundleTimeout
      );

      // Simulate monitoring (replace with real Jito SDK listener in production)
      setTimeout(() => {
        clearTimeout(timeout);
        resolve({ transactionId: bundleId });
      }, 100);
    });
  }

  /**
   * Update market state after a successful trade
   */
  private async updateMarketState(request: OrderRequest, amountLamports: number): Promise<void> {
    const amount = request.type === 'buy' ? amountLamports / 1_000_000_000 : -(amountLamports / 1_000_000_000);
    await this.marketStateManager.updatePosition(request.tokenAddress, amount);
    await this.marketStateManager.updateLiquidity(request.tokenAddress, amount);
    console.log(\`📈 Updated market position: +\${amount} SOL\`);
  }
}
