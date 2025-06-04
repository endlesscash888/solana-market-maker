import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BotConfig } from "./BotConfig";
import PQueue from "p-queue";

export enum TradeSide {
  Buy = "buy",
  Sell = "sell"
}

export interface TradeParams {
  tokenAddress: string;
  side: TradeSide;
  amount: number;
  slippage: number;
}

export interface MarketData {
  price: number;
  volume24h: number;
  liquidity: number;
  timestamp: number;
}

export class TradingEngine {
  private config: BotConfig;
  private queue: PQueue;
  private isActive: boolean = false;
  private lastBalance: { value: number; timestamp: number } | null = null;
  private readonly minTradeSize: number;
  private readonly maxTradeSize: number;
  private readonly positionSizePercent: number;
  private readonly defaultSlippage: number;

  constructor(config: BotConfig) {
    this.config = config;
    
    // Parse environment variables once in constructor
    this.minTradeSize = parseFloat(process.env.MIN_TRADE_SIZE_SOL || "0.01");
    this.maxTradeSize = parseFloat(process.env.MAX_TRADE_SIZE_SOL || "10");
    this.positionSizePercent = parseFloat(process.env.POSITION_SIZE_PERCENT || "0.02");
    this.defaultSlippage = parseFloat(process.env.SLIPPAGE_TOLERANCE || "0.05");
    
    // Dynamic queue configuration using BotConfig properties
    this.queue = new PQueue({ 
      intervalCap: config.maxTPS,
      concurrency: config.maxConcurrency,
      interval: 1000 // 1 second window
    });
  }

  private validateTokenAddress(tokenAddress: string): PublicKey {
    try {
      return new PublicKey(tokenAddress);
    } catch (error) {
      throw new Error(`Invalid tokenAddress: ${tokenAddress}`);
    }
  }

  private validateTradeAmount(amount: number): void {
    if (amount < this.minTradeSize || amount > this.maxTradeSize) {
      throw new Error(`Invalid trade size: ${amount}. Must be between ${this.minTradeSize} and ${this.maxTradeSize} SOL`);
    }
  }

  private validateSlippage(slippage: number): void {
    if (slippage < 0 || slippage > 1) {
      throw new Error(`Invalid slippage: ${slippage}. Must be between 0 and 1`);
    }
  }

  async start(): Promise<void> {
    this.config.logger.info("Starting trading engine...");
    
    const solanaValid = await this.config.validateConnection();
    const redisValid = await this.config.validateRedis();
    
    if (!solanaValid || !redisValid) {
      throw new Error("Failed to validate connections");
    }
    
    await this.optimizeRateLimit();
    this.isActive = true;
    
    this.config.logger.info("Trading engine started successfully");
  }

  async stop(): Promise<void> {
    this.config.logger.info("Stopping trading engine...");
    this.isActive = false;
    await this.queue.onIdle();
    this.config.logger.info("Trading engine stopped");
  }

  private async optimizeRateLimit(): Promise<void> {
    try {
      const perfSamples = await this.config.connection.getRecentPerformanceSamples(1);
      if (perfSamples.length > 0) {
        const recentTPS = Math.min(
          perfSamples[0].numTransactions / perfSamples[0].samplePeriodSecs, 
          this.config.maxTPS
        );
        
        this.queue = new PQueue({
          concurrency: this.config.maxConcurrency,
          intervalCap: Math.max(recentTPS, 10),
          interval: 1000
        });
        
        this.config.logger.info("Dynamic rate limiting optimized", { 
          networkTPS: recentTPS,
          concurrency: this.config.maxConcurrency,
          intervalCap: Math.max(recentTPS, 10)
        });
      }
    } catch (error) {
      this.config.logger.warn("Failed to optimize rate limit, using default", { error });
    }
  }

  async getBalance(): Promise<number> {
    try {
      // Cache balance for 30 seconds to reduce RPC calls
      if (this.lastBalance && Date.now() - this.lastBalance.timestamp < 30000) {
        return this.lastBalance.value;
      }

      const balance = await this.config.connection.getBalance(this.config.keypair.publicKey);
      this.lastBalance = { value: balance / LAMPORTS_PER_SOL, timestamp: Date.now() };
      return this.lastBalance.value;
    } catch (error) {
      this.config.logger.error("Failed to get balance", { error });
      return 0;
    }
  }

  async getMarketData(tokenAddress: string): Promise<MarketData | null> {
    try {
      const tokenKey = this.validateTokenAddress(tokenAddress);
      const cached = await this.config.redis.get(`market:${tokenAddress}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // TODO: Replace with real Pump.fun API call when @pump-fun/pump-sdk is integrated
      // Example integration:
      // if (this.config.pumpApiKey) {
      //   const pumpData = await pumpApi.getTokenInfo(tokenKey.toString());
      //   const marketData = {
      //     price: pumpData.price,
      //     volume24h: pumpData.volume24h,
      //     liquidity: pumpData.liquidity,
      //     timestamp: Date.now()
      //   };
      // } else {
      
      // For development, use mock data with clear warning
      this.config.logger.warn("Using mock market data - integrate @pump-fun/pump-sdk for production", { tokenAddress });
      
      const mockData: MarketData = {
        price: Math.random() * 0.001 + 0.0001,
        volume24h: Math.random() * 10000,
        liquidity: Math.random() * 50000,
        timestamp: Date.now()
      };

      // Adaptive TTL: shorter for high volume, longer for low volume
      const ttl = mockData.volume24h > 10000 ? 5 : 15;
      await this.config.redis.setex(`market:${tokenAddress}`, ttl, JSON.stringify(mockData));
      
      return mockData;
    } catch (error) {
      this.config.logger.error("Failed to get market data", { error, tokenAddress });
      return null;
    }
  }

  async calculateOptimalSize(tokenAddress: string, side: TradeSide): Promise<number> {
    const balance = await this.getBalance();
    const marketData = await this.getMarketData(tokenAddress);
    
    if (!marketData || balance === 0) {
      this.config.logger.warn("Cannot calculate optimal size", { tokenAddress, balance, hasMarketData: !!marketData });
      return 0;
    }

    const targetSize = Math.min(
      balance * this.positionSizePercent,
      this.maxTradeSize
    );

    try {
      this.validateTradeAmount(targetSize);
    } catch (error) {
      // Type-safe error handling
      this.config.logger.warn("Calculated size invalid", { 
        targetSize, 
        error: error instanceof Error ? error.message : "Unknown error"
      });
      return 0;
    }

    this.config.logger.debug("Calculated optimal size", {
      tokenAddress,
      side,
      balance,
      targetSize,
      marketData
    });

    return targetSize;
  }

  async getPosition(tokenAddress: string): Promise<number> {
    try {
      this.validateTokenAddress(tokenAddress);
      const position = await this.config.redis.hget("positions", tokenAddress);
      return position ? parseFloat(position) : 0;
    } catch (error) {
      this.config.logger.error("Failed to get position", { error, tokenAddress });
      return 0;
    }
  }

  async updatePosition(tokenAddress: string, amount: number, side: TradeSide): Promise<void> {
    try {
      this.validateTokenAddress(tokenAddress);
      const currentPosition = await this.getPosition(tokenAddress);
      const newPosition = side === TradeSide.Buy ? currentPosition + amount : currentPosition - amount;
      
      const result = await this.config.redis.multi()
        .hset("positions", tokenAddress, newPosition.toString())
        .expire("positions", 86400)
        .exec();

      if (!result || result.some(([err]) => err)) {
        throw new Error("Redis transaction failed");
      }
        
      this.config.logger.debug("Position updated", {
        tokenAddress,
        side,
        amount,
        oldPosition: currentPosition,
        newPosition
      });
    } catch (error) {
      this.config.logger.error("Failed to update position", { error, tokenAddress, amount, side });
      throw error;
    }
  }

  async updatePositions(updates: { tokenAddress: string; amount: number; side: TradeSide }[]): Promise<void> {
    try {
      const multi = this.config.redis.multi();
      const logs: any[] = [];

      for (const { tokenAddress, amount, side } of updates) {
        this.validateTokenAddress(tokenAddress);
        const currentPosition = await this.getPosition(tokenAddress);
        const newPosition = side === TradeSide.Buy ? currentPosition + amount : currentPosition - amount;

        multi.hset("positions", tokenAddress, newPosition.toString());
        multi.expire("positions", 86400);

        logs.push({ tokenAddress, side, amount, oldPosition: currentPosition, newPosition });
      }

      const result = await multi.exec();
      
      if (!result || result.some(([err]) => err)) {
        throw new Error("Batch position update failed");
      }

      logs.forEach(log => this.config.logger.debug("Position updated", log));
    } catch (error) {
      this.config.logger.error("Failed to update positions", { error, updates });
      throw error;
    }
  }

  async executeMarketMaking(tokenAddress: string, slippage: number = this.defaultSlippage): Promise<void> {
    try {
      const tokenKey = this.validateTokenAddress(tokenAddress);
      this.validateSlippage(slippage);
      
      const marketData = await this.getMarketData(tokenAddress);
      if (!marketData) {
        this.config.logger.warn("No market data available", { tokenAddress });
        return;
      }

      const balance = await this.getBalance();
      if (balance < this.minTradeSize) {
        this.config.logger.warn("Insufficient balance for trading", { balance, minTradeSize: this.minTradeSize });
        return;
      }

      const currentPosition = await this.getPosition(tokenAddress);
      const optimalBuySize = await this.calculateOptimalSize(tokenAddress, TradeSide.Buy);
      const optimalSellSize = await this.calculateOptimalSize(tokenAddress, TradeSide.Sell);

      this.config.logger.info("Market making opportunity", {
        tokenAddress,
        currentPosition,
        marketData,
        optimalBuySize,
        optimalSellSize,
        slippage
      });

      const trades: { tokenAddress: string; amount: number; side: TradeSide; slippage: number }[] = [];
      if (optimalBuySize > 0) {
        trades.push({ tokenAddress, amount: optimalBuySize, side: TradeSide.Buy, slippage });
      }
      if (optimalSellSize > 0) {
        trades.push({ tokenAddress, amount: optimalSellSize, side: TradeSide.Sell, slippage });
      }

      if (trades.length > 0) {
        await this.queue.add(() => this.simulateTradesAndUpdatePositions(trades));
      }
    } catch (error) {
      this.config.logger.error("Market making execution failed", { error, tokenAddress });
    }
  }

  private async simulateTradesAndUpdatePositions(trades: { tokenAddress: string; amount: number; side: TradeSide; slippage: number }[]): Promise<void> {
    try {
      const validTrades: { tokenAddress: string; amount: number; side: TradeSide }[] = [];
      
      for (const { tokenAddress, amount, side, slippage } of trades) {
        this.validateTradeAmount(amount);
        this.validateSlippage(slippage);
        
        const marketData = await this.getMarketData(tokenAddress);
        if (!marketData) {
          this.config.logger.warn("No market data for trade", { tokenAddress });
          continue;
        }

        // Validate slippage tolerance
        const expectedPrice = marketData.price;
        const maxSlippagePrice = side === TradeSide.Buy 
          ? expectedPrice * (1 + slippage) 
          : expectedPrice * (1 - slippage);
          
        // For simulation, we assume market price is within tolerance
        // In production, this would check actual execution price
        if (side === TradeSide.Buy && expectedPrice > maxSlippagePrice) {
          this.config.logger.warn("Trade aborted: price exceeds slippage tolerance", { 
            tokenAddress, 
            side, 
            marketPrice: expectedPrice, 
            maxSlippagePrice 
          });
          continue;
        }
        
        this.config.logger.info("Simulating trade", {
          tokenAddress,
          side,
          amount,
          slippage,
          marketPrice: expectedPrice,
          timestamp: new Date().toISOString()
        });

        // Compact trade format to save Redis storage
        const trade = { 
          t: tokenAddress, 
          s: side, 
          a: amount, 
          p: expectedPrice,
          sl: slippage,
          ts: Date.now() 
        };
        
        const tradeResult = await this.config.redis.multi()
          .lpush(`trades:${tokenAddress}`, JSON.stringify(trade))
          .expire(`trades:${tokenAddress}`, 86400)
          .ltrim(`trades:${tokenAddress}`, 0, 99) // Keep only last 100 trades
          .exec();
          
        if (!tradeResult || tradeResult.some(([err]) => err)) {
          this.config.logger.error("Failed to store trade", { tokenAddress, side, amount });
          continue;
        }
          
        validTrades.push({ tokenAddress, amount, side });
      }

      // Batch update positions for all valid trades
      if (validTrades.length > 0) {
        await this.updatePositions(validTrades);
      }
        
    } catch (error) {
      this.config.logger.error("Trade simulation and position update failed", { error, trades });
    }
  }

  async cleanupOldData(): Promise<void> {
    try {
      const keys = await this.config.redis.keys("trades:*");
      for (const key of keys) {
        await this.config.redis.ltrim(key, 0, 99); // Keep only last 100 trades
      }
      this.config.logger.info("Cleaned up old trade data", { keysProcessed: keys.length });
    } catch (error) {
      this.config.logger.error("Failed to clean old data", { error });
    }
  }

  async getAllPositions(): Promise<Map<string, number>> {
    try {
      const positions = await this.config.redis.hgetall("positions");
      const positionMap = new Map<string, number>();
      
      for (const [token, amount] of Object.entries(positions)) {
        positionMap.set(token, parseFloat(amount));
      }
      
      return positionMap;
    } catch (error) {
      this.config.logger.error("Failed to get all positions", { error });
      return new Map();
    }
  }

  isEngineActive(): boolean {
    return this.isActive;
  }

  async getHealthStatus(): Promise<{ healthy: boolean; details: any }> {
    const balance = await this.getBalance();
    const positions = await this.getAllPositions();
    const queueSize = this.queue.size;
    
    return {
      healthy: this.isActive && balance > 0,
      details: {
        active: this.isActive,
        balance,
        positionCount: positions.size,
        queueSize,
        config: {
          minTradeSize: this.minTradeSize,
          maxTradeSize: this.maxTradeSize,
          positionSizePercent: this.positionSizePercent,
          defaultSlippage: this.defaultSlippage,
          maxTPS: this.config.maxTPS,
          maxConcurrency: this.config.maxConcurrency
        },
        timestamp: Date.now()
      }
    };
  }
}
