import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { createLogger, format, transports } from "winston";
import Redis from "ioredis";
import * as dotenv from "dotenv";

dotenv.config();

export interface BotConfigOptions {
  pumpApiKey?: string;
}

export class BotConfig {
  public readonly connection: Connection;
  public readonly redis: Redis;
  public readonly logger: any;
  public readonly keypair: Keypair;
  public readonly maxTPS: number;
  public readonly maxConcurrency: number;
  public readonly pumpApiKey?: string;
  
  constructor(options: BotConfigOptions = {}) {
    // Initialize Solana connection
    this.connection = new Connection(
      process.env.HELIUS_API_KEY 
        ? `https://rpc.helius.xyz/?api-key=${process.env.HELIUS_API_KEY}`
        : process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
      "confirmed"
    );
    
    // Initialize Redis with validated configuration
    this.redis = new Redis({
      host: process.env.REDIS_URL?.split("://")[1]?.split(":")[0] || "localhost",
      port: parseInt(process.env.REDIS_URL?.split(":")[2] || "6379"),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || "0"),
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableOfflineQueue: false
    });
    
    // Initialize logger
    this.logger = createLogger({
      level: process.env.LOG_LEVEL || "info",
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
      ),
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.simple()
          )
        }),
        new transports.File({ filename: "logs/error.log", level: "error" }),
        new transports.File({ filename: "logs/combined.log" })
      ]
    });
    
    // Redis event handlers for production reliability
    this.redis.on("error", (err) => {
      this.logger.error("Redis connection error:", err);
    });
    
    this.redis.on("ready", () => {
      this.logger.info("Redis connection established");
    });
    
    // Initialize keypair
    if (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY !== "your_base58_private_key_here") {
      try {
        this.keypair = Keypair.fromSecretKey(Buffer.from(process.env.PRIVATE_KEY, "base64"));
      } catch (error) {
        this.logger.warn("Invalid private key format, using temporary keypair");
        this.keypair = Keypair.generate();
      }
    } else {
      this.keypair = Keypair.generate();
      this.logger.warn("Using temporary keypair - add PRIVATE_KEY to .env for production");
    }
    
    // Type-safe configuration with environment parsing
    this.maxTPS = parseInt(process.env.MAX_TPS || "10");
    this.maxConcurrency = parseInt(process.env.MAX_CONCURRENCY || "2");
    this.pumpApiKey = options.pumpApiKey || process.env.PUMP_API_KEY;
    
    this.logger.info("Bot configuration initialized", {
      pubkey: this.keypair.publicKey.toString(),
      rpc: this.connection.rpcEndpoint,
      maxTPS: this.maxTPS,
      maxConcurrency: this.maxConcurrency
    });
  }
  
  async validateConnection(): Promise<boolean> {
    try {
      const version = await this.connection.getVersion();
      this.logger.info("Solana connection validated", { version });
      return true;
    } catch (error) {
      this.logger.error("Solana connection failed", { error });
      return false;
    }
  }
  
  async validateRedis(): Promise<boolean> {
    try {
      await this.redis.connect();
      await this.redis.ping();
      this.logger.info("Redis connection validated");
      return true;
    } catch (error) {
      this.logger.error("Redis connection failed", { error });
      return false;
    }
  }
}
