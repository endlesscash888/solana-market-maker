import { BotConfig } from "./BotConfig";
import { TradingEngine } from "./TradingEngine";
import { PumpFunAdapter } from "./PumpFunAdapter";
import * as dotenv from "dotenv";

dotenv.config();

class SolanaMarketMaker {
  private config: BotConfig;
  private engine: TradingEngine;
  private pumpAdapter: PumpFunAdapter;

  constructor() {
    this.config = new BotConfig();
    this.engine = new TradingEngine(this.config);
    this.pumpAdapter = new PumpFunAdapter(this.config);
  }

  async start(): Promise<void> {
    try {
      this.config.logger.info("🚀 Starting Solana Market-Making Bot...");
      
      // Display configuration
      this.config.logger.info("Configuration:", {
        environment: process.env.NODE_ENV || "development",
        rpcEndpoint: this.config.connection.rpcEndpoint,
        maxTPS: this.config.maxTPS,
        maxConcurrency: this.config.maxConcurrency,
        publicKey: this.config.keypair.publicKey.toString(),
        hasHeliusKey: !!process.env.HELIUS_API_KEY,
        hasPumpKey: !!this.config.pumpApiKey
      });

      // Validate all connections
      const [solanaValid, redisValid] = await Promise.all([
        this.config.validateConnection(),
        this.config.validateRedis()
      ]);

      if (!solanaValid || !redisValid) {
        throw new Error("Failed to validate required connections");
      }

      // Start the trading engine
      await this.engine.start();
      
      // Test PumpFun adapter
      const adapterStatus = await this.pumpAdapter.getQueueStatus();
      this.config.logger.info("PumpFun adapter status:", adapterStatus);
      
      // Start market making for demo tokens
      const demoTokens = [
        "11111111111111111111111111111112", // System Program ID for demo
        "So11111111111111111111111111111111111111112"  // Wrapped SOL for demo
      ];
      
      this.config.logger.info("🎯 Starting market making...");
      
      // Run market making loop
      this.startMarketMakingLoop(demoTokens);
      
      this.config.logger.info("✅ Bot started successfully - Press Ctrl+C to stop");

    } catch (error) {
      this.config.logger.error("❌ Failed to start bot:", error);
      process.exit(1);
    }
  }

  private startMarketMakingLoop(tokenAddresses: string[]): void {
    // Execute market making every 15 seconds
    const interval = setInterval(async () => {
      try {
        if (!this.engine.isEngineActive()) {
          this.config.logger.warn("Engine not active, stopping market making");
          clearInterval(interval);
          return;
        }

        // Execute market making for each token
        for (const tokenAddress of tokenAddresses) {
          await this.executeMarketMakingCycle(tokenAddress);
        }
        
        // Get health status every 4th iteration (60 seconds)
        if (Date.now() % 60000 < 15000) {
          const [engineHealth, pumpStatus] = await Promise.all([
            this.engine.getHealthStatus(),
            this.pumpAdapter.getQueueStatus()
          ]);
          
          this.config.logger.info("📊 System Health:", {
            engine: engineHealth,
            pumpAdapter: pumpStatus,
            timestamp: new Date().toISOString()
          });
        }

      } catch (error) {
        this.config.logger.error("Market making iteration failed:", error);
      }
    }, 15000); // 15 second intervals

    // Cleanup old data every 5 minutes
    const cleanupInterval = setInterval(async () => {
      try {
        await this.engine.cleanupOldData();
      } catch (error) {
        this.config.logger.error("Cleanup failed:", error);
      }
    }, 300000); // 5 minutes

    // Graceful shutdown handling
    const shutdown = async () => {
      this.config.logger.info("🛑 Received shutdown signal, stopping gracefully...");
      clearInterval(interval);
      clearInterval(cleanupInterval);
      await this.stop();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }

  private async executeMarketMakingCycle(tokenAddress: string): Promise<void> {
    try {
      // Test PumpFun adapter functionality
      const isValidPool = await this.pumpAdapter.isValidPool(tokenAddress);
      if (!isValidPool) {
        this.config.logger.debug("Invalid or non-existent pool", { tokenAddress });
        return;
      }

      // Get market data from PumpFun adapter
      const [bondingCurveState, tokenPrice] = await Promise.all([
        this.pumpAdapter.getBondingCurveState(tokenAddress),
        this.pumpAdapter.getTokenPrice(tokenAddress)
      ]);

      if (!bondingCurveState || !tokenPrice) {
        this.config.logger.debug("No market data available", { tokenAddress });
        return;
      }

      // Execute trading engine market making
      await this.engine.executeMarketMaking(tokenAddress);

      // Simulate a swap for demonstration (using safe test parameters)
      const swapResult = await this.pumpAdapter.simulateSwap({
        mint: tokenAddress,
        amount: 0.001, // Small test amount
        direction: Math.random() > 0.5 ? "buy" : "sell",
        poolId: tokenAddress,
        slippageBps: 500 // 5% slippage
      });

      this.config.logger.info("Market making cycle completed", {
        tokenAddress,
        bondingCurveComplete: bondingCurveState.complete,
        tokenPrice,
        swapSimulation: swapResult,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.config.logger.error("Market making cycle failed", { 
        error: error instanceof Error ? error.message : String(error),
        tokenAddress 
      });
    }
  }

  async stop(): Promise<void> {
    try {
      this.config.logger.info("🔄 Stopping trading engine...");
      await this.engine.stop();
      
      this.config.logger.info("🔄 Closing Redis connection...");
      await this.config.redis.quit();
      
      this.config.logger.info("✅ Bot stopped successfully");
    } catch (error) {
      this.config.logger.error("❌ Error during shutdown:", error);
    }
  }

  async getStatus(): Promise<any> {
    const [engineStatus, pumpStatus] = await Promise.all([
      this.engine.getHealthStatus(),
      this.pumpAdapter.getQueueStatus()
    ]);

    return {
      engine: engineStatus,
      pumpAdapter: pumpStatus,
      positions: await this.engine.getAllPositions(),
      timestamp: new Date().toISOString()
    };
  }

  // Method to upgrade to real Pump.fun SDK when ready
  async enablePumpFunTrading(): Promise<void> {
    try {
      await this.pumpAdapter.upgradeToPumpFunSDK();
      this.config.logger.info("🎯 Pump.fun trading enabled");
    } catch (error) {
      this.config.logger.error("Failed to enable Pump.fun trading", { error });
      throw error;
    }
  }
}

// Start the bot if this file is run directly
if (require.main === module) {
  const bot = new SolanaMarketMaker();
  
  bot.start().catch((error) => {
    console.error("Fatal error starting bot:", error);
    process.exit(1);
  });
}

export { SolanaMarketMaker };
