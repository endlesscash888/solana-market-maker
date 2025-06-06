import { Connection } from "@solana/web3.js";
import { Redis } from "ioredis";
import winston from "winston";
import { TradingConfig, TradingEngineConfig } from "./interfaces/TradingConfig.js";

export class ConfigManager {
  private connection: Connection;
  private redis: Redis;
  private logger: winston.Logger;

  constructor() {
    // Initialize connection
    const rpcEndpoint = process.env.HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";
    this.connection = new Connection(rpcEndpoint, "confirmed");

    // Initialize Redis
    this.redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });

    // Initialize logger
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: "logs/trading.log" })
      ]
    });
  }

  getTradingConfig(): TradingConfig {
    return {
      connection: this.connection,
      rpcEndpoint: this.connection.rpcEndpoint,
      maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || "1.0"),
      minOrderSize: parseFloat(process.env.MIN_ORDER_SIZE || "0.01"),
      maxSlippage: parseFloat(process.env.MAX_SLIPPAGE || "0.02"),
      orderRefreshInterval: parseInt(process.env.ORDER_REFRESH_INTERVAL || "5000"),
      emergencyStopLoss: parseFloat(process.env.EMERGENCY_STOP_LOSS || "0.05")
    };
  }

  getTradingEngineConfig(): TradingEngineConfig {
    return {
      ...this.getTradingConfig(),
      redis: this.redis,
      logger: this.logger
    };
  }

  getRedis(): Redis {
    return this.redis;
  }

  getLogger(): winston.Logger {
    return this.logger;
  }

  getConnection(): Connection {
    return this.connection;
  }

  async validateConnection(): Promise<void> {
    const version = await this.connection.getVersion();
    this.logger.info("Solana connection validated", { version });
  }

  async cleanup(): Promise<void> {
    await this.redis.quit();
    this.logger.info("ConfigManager cleaned up");
  }
}
