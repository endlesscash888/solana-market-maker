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
    // Validate required environment variables
    this.validateEnvironment();
    
    // Initialize Solana connection with Helius if available
    const rpcUrl = process.env.HELIUS_API_KEY 
      ? `https://rpc.helius.xyz/?api-key=${process.env.HELIUS_API_KEY}`
      : process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
      
    this.connection = new Connection(rpcUrl, "confirmed");
    
    // Initialize Redis with production configuration
    this.redis = new Redis({
      host: this.parseRedisHost(),
      port: this.parseRedisPort(),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || "0"),
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableOfflineQueue: false
    });
    
    // Initialize logger with production settings
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
        new transports.File({ 
          filename: "logs/error.log", 
          level: "error",
          maxsize: 10485760, // 10MB
          maxFiles: 5
        }),
        new transports.File({ 
          filename: "logs/combined.log",
          maxsize: 10485760, // 10MB
          maxFiles: 5
        })
      ]
    });
    
    // Redis event handlers for production reliability
    this.redis.on("error", (err) => {
      this.logger.error("Redis connection error:", err);
    });
    
    this.redis.on("ready", () => {
      this.logger.info("Redis connection established");
    });
    
    // Initialize keypair with validation
    this.keypair = this.initializeKeypair();
    
    // Configuration options with validation
    this.maxTPS = this.validateNumber(process.env.MAX_TPS, 10, 1, 100);
    this.maxConcurrency = this.validateNumber(process.env.MAX_CONCURRENCY, 2, 1, 10);
    this.pumpApiKey = options.pumpApiKey || process.env.PUMP_API_KEY;
    
    this.logger.info("Bot configuration initialized", {
      pubkey: this.keypair.publicKey.toString(),
      rpc: this.connection.rpcEndpoint,
      maxTPS: this.maxTPS,
      maxConcurrency: this.maxConcurrency,
      nodeEnv: process.env.NODE_ENV || "development",
      hasHeliusKey: !!process.env.HELIUS_API_KEY,
      hasPumpKey: !!this.pumpApiKey
    });
  }
  
  private validateEnvironment(): void {
    const required = ["PRIVATE_KEY"];
    const missing = required.filter(key => !process.env[key] || process.env[key] === `your_${key.toLowerCase()}_here`);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
    }
    
    // Warn about production settings
    if (process.env.NODE_ENV === "production") {
      const warnings = [];
      if (!process.env.HELIUS_API_KEY) warnings.push("HELIUS_API_KEY not set - using free RPC");
      if (!process.env.REDIS_PASSWORD) warnings.push("REDIS_PASSWORD not set - using local Redis");
      
      if (warnings.length > 0) {
        console.warn("Production warnings:", warnings.join(", "));
      }
    }
  }
  
  private parseRedisHost(): string {
    if (!process.env.REDIS_URL) return "localhost";
    
    try {
      const url = new URL(process.env.REDIS_URL);
      return url.hostname;
    } catch {
      // Fallback for simple host:port format
      return process.env.REDIS_URL.split("://")[1]?.split(":")[0] || "localhost";
    }
  }
  
  private parseRedisPort(): number {
    if (!process.env.REDIS_URL) return 6379;
    
    try {
      const url = new URL(process.env.REDIS_URL);
      return parseInt(url.port) || 6379;
    } catch {
      // Fallback for simple host:port format
      return parseInt(process.env.REDIS_URL.split(":")[2] || "6379");
    }
  }
  
  private initializeKeypair(): Keypair {
    const privateKey = process.env.PRIVATE_KEY;
    
    if (!privateKey || privateKey === "your_base58_private_key_here") {
      this.logger.warn("Using temporary keypair - add PRIVATE_KEY to .env for production");
      return Keypair.generate();
    }
    
    try {
      // Try base64 format first
      return Keypair.fromSecretKey(Buffer.from(privateKey, "base64"));
    } catch {
      try {
        // Try base58 format
        const bs58 = require("bs58");
        return Keypair.fromSecretKey(bs58.decode(privateKey));
      } catch {
        try {
          // Try JSON array format
          return Keypair.fromSecretKey(new Uint8Array(JSON.parse(privateKey)));
        } catch (error) {
          this.logger.error("Invalid private key format. Supported: base64, base58, JSON array");
          this.logger.warn("Using temporary keypair");
          return Keypair.generate();
        }
      }
    }
  }
  
  private validateNumber(value: string | undefined, defaultValue: number, min: number, max: number): number {
    if (!value) return defaultValue;
    
    const num = parseInt(value);
    if (isNaN(num) || num < min || num > max) {
      this.logger.warn(`Invalid value ${value}, using default ${defaultValue}`);
      return defaultValue;
    }
    
    return num;
  }
  
  async validateConnection(): Promise<boolean> {
    try {
      const version = await this.connection.getVersion();
      this.logger.info("Solana connection validated", { 
        version,
        endpoint: this.connection.rpcEndpoint
      });
      return true;
    } catch (error) {
      this.logger.error("Solana connection failed", { 
        error,
        endpoint: this.connection.rpcEndpoint
      });
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
