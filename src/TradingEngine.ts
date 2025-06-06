import { Redis } from "ioredis";
import winston from "winston";
import { PumpFunAdapter } from "./PumpFunAdapter.js";
import { TradingEngineConfig } from "./interfaces/TradingConfig.js";
import { Queue } from "p-queue";

export class TradingEngine {
  private isActive: boolean = false;
  private executionQueue: Queue;
  private positions: Map<string, any> = new Map();
  private lastHealthCheck: Date = new Date();

  constructor(
    private readonly config: TradingEngineConfig,
    private readonly pumpAdapter: PumpFunAdapter,
    private readonly redis: Redis,
    private readonly logger: winston.Logger
  ) {
    this.executionQueue = new Queue({ 
      concurrency: 1, 
      interval: 1000, 
      intervalCap: 10 
    });
    
    this.logger.info("TradingEngine initialized with explicit dependencies", {
      rpcEndpoint: config.rpcEndpoint,
      maxPositionSize: config.maxPositionSize,
      redisConnected: redis.status === "ready"
    });
  }

  async start(): Promise<void> {
    this.isActive = true;
    await this.restoreStateFromRedis();
    this.logger.info("TradingEngine started successfully");
  }

  async stop(): Promise<void> {
    this.isActive = false;
    await this.saveStateToRedis();
    this.logger.info("TradingEngine stopped gracefully");
  }

  async executeMarketMaking(tokenMint: string, amount: number): Promise<void> {
    if (!this.isActive) {
      throw new Error("Engine is not active");
    }

    await this.executionQueue.add(async () => {
      try {
        const startTime = Date.now();
        
        // Simulate market making logic
        const result = await this.pumpAdapter.executeTrade({
          tokenMint,
          amount,
          slippage: this.config.maxSlippage
        });

        const latency = Date.now() - startTime;
        
        await this.updatePosition(tokenMint, amount, result);
        
        this.logger.info("Market making executed", {
          tokenMint,
          amount,
          latency,
          success: true
        });

      } catch (error) {
        this.logger.error("Market making failed", {
          tokenMint,
          amount,
          error: error instanceof Error ? error.message : "Unknown error"
        });
        throw error;
      }
    });
  }

  private async updatePosition(tokenMint: string, amount: number, result: any): Promise<void> {
    const position = this.positions.get(tokenMint) || { amount: 0, entries: [] };
    position.amount += amount;
    position.entries.push({
      timestamp: new Date(),
      amount,
      price: result.price
    });
    
    this.positions.set(tokenMint, position);
    
    // Persist to Redis
    await this.redis.hset(
      "positions",
      tokenMint,
      JSON.stringify(position)
    );
  }

  private async restoreStateFromRedis(): Promise<void> {
    try {
      const positions = await this.redis.hgetall("positions");
      for (const [tokenMint, positionData] of Object.entries(positions)) {
        this.positions.set(tokenMint, JSON.parse(positionData));
      }
      this.logger.info(`Restored ${this.positions.size} positions from Redis`);
    } catch (error) {
      this.logger.error("Failed to restore state from Redis", { error });
    }
  }

  private async saveStateToRedis(): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    for (const [tokenMint, position] of this.positions.entries()) {
      pipeline.hset("positions", tokenMint, JSON.stringify(position));
    }
    
    await pipeline.exec();
    this.logger.info(`Saved ${this.positions.size} positions to Redis`);
  }

  getHealthStatus(): object {
    return {
      isActive: this.isActive,
      positionsCount: this.positions.size,
      queueSize: this.executionQueue.size,
      lastHealthCheck: this.lastHealthCheck,
      uptime: Date.now() - this.lastHealthCheck.getTime()
    };
  }

  isEngineActive(): boolean {
    return this.isActive;
  }

  getAllPositions(): Map<string, any> {
    return new Map(this.positions);
  }

  async cleanupOldData(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    
    for (const [tokenMint, position] of this.positions.entries()) {
      position.entries = position.entries.filter(
        (entry: any) => new Date(entry.timestamp) > cutoffDate
      );
      
      if (position.entries.length === 0) {
        this.positions.delete(tokenMint);
        await this.redis.hdel("positions", tokenMint);
      }
    }
    
    this.logger.info("Cleaned up old position data");
  }
}
