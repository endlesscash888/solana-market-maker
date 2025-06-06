import { ConfigManager } from "./ConfigManager.js";
import { TradingEngine } from "./TradingEngine.js";
import { PumpFunAdapter } from "./PumpFunAdapter.js";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

class SolanaMarketMaker {
  private configManager: ConfigManager;
  private engine: TradingEngine;
  private pumpAdapter: PumpFunAdapter;

  constructor() {
    // Initialize configuration manager
    this.configManager = new ConfigManager();
    
    // Get dependencies
    const redis = this.configManager.getRedis();
    const logger = this.configManager.getLogger();
    
    // Initialize adapters with explicit dependencies
    this.pumpAdapter = new PumpFunAdapter(redis, logger);
    
    // Initialize trading engine with all dependencies
    this.engine = new TradingEngine(
      this.configManager.getTradingEngineConfig(),
      this.pumpAdapter,
      redis,
      logger
    );
    
    logger.info("SolanaMarketMaker initialized with explicit dependency injection");
  }

  async start(): Promise<void> {
    try {
      // Validate connections
      await this.configManager.validateConnection();
      
      // Start trading engine
      await this.engine.start();
      
      // Log initial status
      const healthStatus = this.engine.getHealthStatus();
      this.configManager.getLogger().info("Market maker started", { health: healthStatus });
      
      // Example: Execute a market making operation
      if (process.env.ENABLE_TRADING === "true") {
        await this.engine.executeMarketMaking(
          "So11111111111111111111111111111111111111112", 
          0.01
        );
      }
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
    } catch (error) {
      this.configManager.getLogger().error("Startup failed", { 
        error: error instanceof Error ? error.message : "Unknown error"
      });
      await this.shutdown();
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const signals = ["SIGINT", "SIGTERM", "SIGQUIT"];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        this.configManager.getLogger().info(`Received ${signal}, shutting down gracefully`);
        await this.shutdown();
        process.exit(0);
      });
    });
  }

  private async shutdown(): Promise<void> {
    try {
      await this.engine.stop();
      await this.configManager.cleanup();
      this.configManager.getLogger().info("Shutdown completed successfully");
    } catch (error) {
      this.configManager.getLogger().error("Error during shutdown", { error });
    }
  }
}

// Bootstrap application
const marketMaker = new SolanaMarketMaker();
marketMaker.start().catch(error => {
  console.error("Failed to start market maker:", error);
  process.exit(1);
});
