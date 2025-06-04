import { BotConfig } from "./BotConfig";
import { TradingEngine } from "./TradingEngine";
import * as dotenv from "dotenv";

dotenv.config();

class SolanaMarketMaker {
  private config: BotConfig;
  private engine: TradingEngine;

  constructor() {
    this.config = new BotConfig();
    this.engine = new TradingEngine(this.config);
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
        publicKey: this.config.keypair.publicKey.toString()
      });

      // Start the trading engine
      await this.engine.start();
      
      // Start market making for demo token (replace with real token addresses)
      const demoTokenAddress = "11111111111111111111111111111112"; // System Program ID for demo
      
      this.config.logger.info("🎯 Starting market making...");
      
      // Run market making loop
      this.startMarketMakingLoop(demoTokenAddress);
      
      this.config.logger.info("✅ Bot started successfully - Press Ctrl+C to stop");

    } catch (error) {
      this.config.logger.error("❌ Failed to start bot:", error);
      process.exit(1);
    }
  }

  private startMarketMakingLoop(tokenAddress: string): void {
    // Execute market making every 10 seconds
    const interval = setInterval(async () => {
      try {
        if (!this.engine.isEngineActive()) {
          this.config.logger.warn("Engine not active, stopping market making");
          clearInterval(interval);
          return;
        }

        await this.engine.executeMarketMaking(tokenAddress);
        
        // Get health status every 5th iteration (50 seconds)
        if (Date.now() % 50000 < 10000) {
          const health = await this.engine.getHealthStatus();
          this.config.logger.info("📊 Health Status:", health);
        }

      } catch (error) {
        this.config.logger.error("Market making iteration failed:", error);
      }
    }, 10000); // 10 second intervals

    // Cleanup old data every 5 minutes
    const cleanupInterval = setInterval(async () => {
      try {
        await this.engine.cleanupOldData();
      } catch (error) {
        this.config.logger.error("Cleanup failed:", error);
      }
    }, 300000); // 5 minutes

    // Graceful shutdown handling
    process.on("SIGINT", async () => {
      this.config.logger.info("🛑 Received SIGINT, shutting down gracefully...");
      clearInterval(interval);
      clearInterval(cleanupInterval);
      await this.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      this.config.logger.info("🛑 Received SIGTERM, shutting down gracefully...");
      clearInterval(interval);
      clearInterval(cleanupInterval);
      await this.stop();
      process.exit(0);
    });
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
    return {
      engine: await this.engine.getHealthStatus(),
      positions: await this.engine.getAllPositions(),
      timestamp: new Date().toISOString()
    };
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
