import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import { Redis } from "ioredis";
import winston from "winston";

export interface BotConfigOptions {
  connection?: Connection;
  keypair?: Keypair;
  redis?: Redis;
  logger?: winston.Logger;
}

export class BotConfig {
  public readonly connection: Connection;
  public readonly keypair: Keypair;
  public readonly redis: Redis;
  public readonly logger: winston.Logger;
  public readonly maxTPS: number;
  public readonly maxConcurrency: number;
  public readonly pumpApiKey: string;

  constructor(options: BotConfigOptions = {}) {
    this.logger = options.logger || this.setupLogger();
    this.connection = options.connection || this.setupConnection();
    this.keypair = options.keypair || this.setupWallet();
    this.redis = options.redis || this.setupRedis();
    
    // Load configuration from env
    this.maxTPS = parseInt(process.env.MAX_TPS || "10");
    this.maxConcurrency = parseInt(process.env.MAX_CONCURRENCY || "5");
    this.pumpApiKey = process.env.PUMP_API_KEY || "";
  }

  private setupLogger(): winston.Logger {
    return winston.createLogger({
      level: process.env.LOG_LEVEL || "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }

  private setupConnection(): Connection {
    const rpcUrl = process.env.HELIUS_API_KEY
      ? `https://rpc.helius.xyz/?api-key=${process.env.HELIUS_API_KEY}`
      : "https://api.devnet.solana.com";
    
    const connection = new Connection(rpcUrl, "confirmed");
    this.logger.info(`Connected to Solana RPC: ${rpcUrl.includes("helius") ? "Helius (masked)" : "Devnet"}`);
    return connection;
  }

  private setupWallet(): Keypair {
    const privateKey = process.env.PRIVATE_KEY;
    
    // Production safety check from review
    if (!privateKey && process.env.NODE_ENV === "production") {
      this.logger.error("PRIVATE_KEY is required in production mode");
      throw new Error("Missing PRIVATE_KEY in production");
    }

    if (!privateKey) {
      this.logger.warn("Generating temporary keypair for non-production mode");
      return Keypair.generate();
    }

    try {
      let secretKey: Uint8Array;
      if (privateKey.includes(",")) {
        secretKey = new Uint8Array(privateKey.split(",").map(num => parseInt(num.trim())));
      } else {
        secretKey = new Uint8Array(Buffer.from(privateKey, "base64"));
      }

      if (secretKey.length !== 64) {
        throw new Error("Invalid secret key length - must be 64 bytes");
      }

      const keypair = Keypair.fromSecretKey(secretKey);
      this.logger.info("Wallet loaded successfully (public key masked for security)");
      return keypair;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error("Failed to parse private key", { error: errorMsg });
      throw new Error("Invalid private key format");
    }
  }

  private setupRedis(): Redis {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    
    try {
      const client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 5000,
        family: 4,
        retryStrategy: (times: number): number | null => {
          if (times > 3) return null;
          return Math.min(times * 100, 500);
        },
      });

      client.on("connect", () => {
        this.logger.info("✅ Redis connected successfully");
      });

      client.on("error", (err: Error) => {
        this.logger.error("❌ Redis connection error", { error: err.message });
      });

      return client;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error("Failed to setup Redis client", { error: errorMsg });
      throw error;
    }
  }

  public async validateConnection(): Promise<boolean> {
    try {
      const version = await this.connection.getVersion();
      this.logger.info("Solana connection validated", { version: version["solana-core"] });
      return true;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error("Failed to validate Solana connection", { error: errorMsg });
      return false;
    }
  }

  public async validateRedis(): Promise<boolean> {
    try {
      await this.redis.ping();
      this.logger.info("Redis connection validated");
      return true;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error("Failed to validate Redis connection", { error: errorMsg });
      return false;
    }
  }

  public getAnchorProvider(): AnchorProvider {
    // Simple wallet implementation that works with both Transaction types
    const wallet = {
      publicKey: this.keypair.publicKey,
      signTransaction: async (tx: Transaction | VersionedTransaction) => {
        if (tx instanceof Transaction) {
          tx.partialSign(this.keypair);
        } else {
          // For VersionedTransaction, we need to sign differently
          tx.sign([this.keypair]);
        }
        return tx;
      },
      signAllTransactions: async (txs: (Transaction | VersionedTransaction)[]) => {
        txs.forEach(tx => {
          if (tx instanceof Transaction) {
            tx.partialSign(this.keypair);
          } else {
            tx.sign([this.keypair]);
          }
        });
        return txs;
      }
    };

    return new AnchorProvider(this.connection, wallet as any, {
      commitment: "confirmed",
      preflightCommitment: "confirmed"
    });
  }

  public getRedis(): Redis {
    return this.redis;
  }

  public getLogger(): winston.Logger {
    return this.logger;
  }

  public validatePublicKey(key: string): PublicKey {
    try {
      return new PublicKey(key);
    } catch (error: unknown) {
      throw new Error(`Invalid public key: ${key}`);
    }
  }

  public validateSlippage(slippageBps: number): void {
    if (slippageBps < 0 || slippageBps > 1000) {
      throw new Error(`Invalid slippage: ${slippageBps}. Must be between 0-1000 bps (0-10%)`);
    }
  }

  public async cleanup(): Promise<void> {
    try {
      await this.redis.quit();
      this.logger.info("Redis connection closed cleanly");
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error("Error during cleanup", { error: errorMsg });
    }
  }

  public getMaxSlippageBps(): number {
    return parseInt(process.env.MAX_SLIPPAGE_BPS || "1000");
  }

  public getDefaultTokenAmount(): number {
    return parseFloat(process.env.DEFAULT_TOKEN_AMOUNT || "0.01");
  }

  public isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  }

  public isDryRun(): boolean {
    return process.env.ENABLE_DRY_RUN === "true";
  }
}

export const createBotConfig = (options: BotConfigOptions = {}): BotConfig => {
  return new BotConfig(options);
};
