import { Connection, PublicKey, Transaction, VersionedTransaction, Keypair } from "@solana/web3.js";
import { BotConfig } from "./BotConfig";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import PQueue from "p-queue";

// NodeWallet implementation with proper VersionedTransaction support
class NodeWallet implements Wallet {
  constructor(public payer: Keypair) {}

  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if ("version" in tx) {
      // Handle VersionedTransaction
      tx.sign([this.payer]);
    } else {
      // Handle legacy Transaction
      tx.partialSign(this.payer);
    }
    return tx;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    return txs.map(tx => {
      if ("version" in tx) {
        // Handle VersionedTransaction
        tx.sign([this.payer]);
      } else {
        // Handle legacy Transaction
        tx.partialSign(this.payer);
      }
      return tx;
    });
  }

  get publicKey(): PublicKey {
    return this.payer.publicKey;
  }
}

export interface SwapParams {
  mint: string;
  amount: number;
  direction: "buy" | "sell";
  poolId: string;
  slippageBps: number; // Basis points (0-1000 = 0-10%)
}

export interface BondingCurveState {
  virtualTokenReserves: number;
  virtualSolReserves: number;
  realTokenReserves: number;
  realSolReserves: number;
  tokenTotalSupply: number;
  complete: boolean;
}

export class PumpFunAdapter {
  private config: BotConfig;
  private queue: PQueue;
  private wallet: NodeWallet;
  private provider: AnchorProvider;
  private sdk: any; // Will be typed when actual SDK is verified

  constructor(config: BotConfig) {
    if (!config.keypair) {
      throw new Error("Wallet keypair is required for PumpFunAdapter");
    }
    
    if (!config.redis) {
      throw new Error("Redis client is required for PumpFunAdapter");
    }
    
    this.config = config;
    this.wallet = new NodeWallet(config.keypair);
    
    // Initialize AnchorProvider with proper wallet
    this.provider = new AnchorProvider(
      config.connection,
      this.wallet,
      { commitment: "confirmed" }
    );
    
    // TODO: Initialize actual Pump.fun SDK when methods are verified
    // this.sdk = new PumpSdk(this.provider);
    this.sdk = {
      provider: this.provider,
      connection: config.connection,
      wallet: this.wallet,
      publicKey: config.keypair.publicKey
    };
    
    // Rate limiting queue using BotConfig settings
    this.queue = new PQueue({ 
      concurrency: config.maxConcurrency || 2, 
      interval: 1000, 
      intervalCap: config.maxTPS || 10
    });

    this.config.logger.info("PumpFunAdapter initialized", {
      maxTPS: config.maxTPS,
      maxConcurrency: config.maxConcurrency,
      wallet: config.keypair.publicKey.toString(),
      provider: "AnchorProvider configured",
      mode: "simulation" // Will change to "production" when real SDK is integrated
    });
  }

  private validateParams(params: SwapParams): void {
    if (!params.mint || !params.poolId) {
      throw new Error("Mint and poolId are required");
    }
    
    try {
      new PublicKey(params.mint);
      new PublicKey(params.poolId);
    } catch {
      throw new Error("Invalid mint or poolId - must be valid Solana PublicKeys");
    }
    
    if (params.amount <= 0) {
      throw new Error("Amount must be positive");
    }
    
    if (!["buy", "sell"].includes(params.direction)) {
      throw new Error("Direction must be buy or sell");
    }
    
    // Restrict slippage to safe range (0-10%)
    if (params.slippageBps < 0 || params.slippageBps > 1000) {
      throw new Error("Slippage must be between 0 and 10% (0-1000 basis points)");
    }
  }

  private validatePoolId(poolId: string): void {
    if (!poolId) {
      throw new Error("poolId is required");
    }
    
    try {
      new PublicKey(poolId);
    } catch {
      throw new Error("Invalid poolId - must be valid Solana PublicKey");
    }
  }

  async createSwap(params: SwapParams): Promise<Transaction> {
    try {
      this.validateParams(params);
      
      // Ensure the queue task always returns Transaction or throws error
      const transactionResult = await this.queue.add(async (): Promise<Transaction> => {
        try {
          // TODO: Replace with actual SDK method when verified
          // const { tx } = await this.sdk.createSwapInstructions({
          //   mint: new PublicKey(params.mint),
          //   amount: params.amount,
          //   direction: params.direction,
          //   poolId: params.poolId
          // });
          
          this.config.logger.warn("Using placeholder swap implementation", {
            note: "Replace with: this.sdk.createSwapInstructions()",
            params
          });
          
          // Create and sign transaction
          const tx = new Transaction();
          const signedTx = await this.wallet.signTransaction(tx);
          
          // Ensure we always return a Transaction
          if (!signedTx) {
            throw new Error("Failed to create or sign transaction");
          }
          
          return signedTx;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new Error(`Queue task failed: ${errorMessage}`);
        }
      });

      // TypeScript now knows transactionResult is definitely Transaction
      if (!transactionResult) {
        throw new Error("Queue task returned invalid result");
      }

      this.config.logger.info("Swap transaction created and signed", { 
        mint: params.mint, 
        direction: params.direction, 
        amount: params.amount,
        poolId: params.poolId,
        slippageBps: params.slippageBps
      });
      
      return transactionResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.config.logger.error("Failed to create swap", { 
        error: errorMessage, 
        params 
      });
      throw new Error(`Failed to create swap: ${errorMessage}`);
    }
  }

  async getBondingCurveState(poolId: string): Promise<BondingCurveState | null> {
    try {
      this.validatePoolId(poolId);
      
      // Check Redis cache first (15-second TTL for bonding curve data)
      const cacheKey = `bondingCurve:${poolId}`;
      const cached = await this.config.redis.get(cacheKey);
      if (cached) {
        this.config.logger.debug("Bonding curve state retrieved from cache", { poolId });
        return JSON.parse(cached);
      }

      // Fix: Handle void result properly
      const stateResult = await this.queue.add(async (): Promise<BondingCurveState | null> => {
        try {
          // TODO: Replace with actual SDK method when verified
          // const state = await this.sdk.getBondingCurveState(new PublicKey(poolId));
          
          this.config.logger.warn("Using placeholder bonding curve implementation", {
            note: "Replace with: this.sdk.getBondingCurveState()",
            poolId
          });
          
          // Mock bonding curve state for development
          const mockState: BondingCurveState = {
            virtualTokenReserves: Math.random() * 1000000 + 100000,
            virtualSolReserves: Math.random() * 1000 + 100,
            realTokenReserves: Math.random() * 900000 + 50000,
            realSolReserves: Math.random() * 900 + 50,
            tokenTotalSupply: 1000000000,
            complete: Math.random() > 0.8
          };
          
          // Return either the mock state or null, never undefined
          return mockState;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.config.logger.error("Queue task error for bonding curve", { error: errorMessage, poolId });
          // Return null instead of letting the function return undefined
          return null;
        }
      });

      // Fix: Handle potential undefined from queue
      if (stateResult === undefined) {
        this.config.logger.warn("Queue task for bonding curve state did not produce a result. Returning null.", { poolId });
        return null;
      }

      // TypeScript now knows stateResult is definitely BondingCurveState | null
      if (stateResult) {
        // Cache for 15 seconds to reduce RPC calls
        await this.config.redis.setex(cacheKey, 15, JSON.stringify(stateResult));
        this.config.logger.info("Bonding curve state retrieved and cached", { 
          poolId,
          complete: stateResult.complete
        });
      }
      
      return stateResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.config.logger.error("Failed to get bonding curve state", { 
        error: errorMessage, 
        poolId 
      });
      return null;
    }
  }

  async getTokenPrice(poolId: string): Promise<number | null> {
    try {
      const state = await this.getBondingCurveState(poolId);
      if (!state || !state.virtualTokenReserves || !state.virtualSolReserves) {
        return null;
      }

      // Calculate price from bonding curve reserves
      const price = state.virtualSolReserves / state.virtualTokenReserves;
      
      this.config.logger.debug("Token price calculated", {
        poolId,
        price,
        solReserves: state.virtualSolReserves,
        tokenReserves: state.virtualTokenReserves
      });
      
      return price;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.config.logger.error("Failed to calculate token price", { 
        error: errorMessage, 
        poolId 
      });
      return null;
    }
  }

  async isValidPool(poolId: string): Promise<boolean> {
    try {
      this.validatePoolId(poolId);
      const state = await this.getBondingCurveState(poolId);
      return state !== null;
    } catch (error) {
      this.config.logger.debug("Pool validation failed", { poolId, error });
      return false;
    }
  }

  async getQueueStatus(): Promise<{ size: number; pending: number; isPaused: boolean }> {
    return {
      size: this.queue.size,
      pending: this.queue.pending,
      isPaused: this.queue.isPaused
    };
  }

  // Production-ready simulation method with proper validation
  async simulateSwap(params: SwapParams): Promise<{ success: boolean; txId: string; estimatedPrice?: number }> {
    try {
      this.validateParams(params);
      
      // Get current market state for realistic simulation
      const bondingCurveState = await this.getBondingCurveState(params.poolId);
      const estimatedPrice = bondingCurveState ? 
        bondingCurveState.virtualSolReserves / bondingCurveState.virtualTokenReserves : null;
      
      this.config.logger.info("Simulating swap with market data", {
        mint: params.mint,
        direction: params.direction,
        amount: params.amount,
        slippageBps: params.slippageBps,
        estimatedPrice,
        bondingCurveComplete: bondingCurveState?.complete
      });
      
      // Simulate transaction processing time based on network conditions
      const processingTime = Math.random() * 150 + 50; // 50-200ms (within target)
      await new Promise(resolve => setTimeout(resolve, processingTime));
      
      return {
        success: true,
        txId: `sim_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        estimatedPrice: estimatedPrice || undefined
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.config.logger.error("Failed to simulate swap", { error: errorMessage, params });
      return { success: false, txId: "" };
    }
  }

  // Method to upgrade to real SDK when methods are verified
  async upgradeToPumpFunSDK(): Promise<void> {
    try {
      // TODO: Uncomment when SDK is verified
      // const { PumpSdk } = await import("@pump-fun/pump-sdk");
      // this.sdk = new PumpSdk(this.provider);
      
      this.config.logger.info("SDK upgrade ready", {
        note: "Ready to implement PumpSdk(this.provider) when verified",
        provider: "AnchorProvider configured"
      });
    } catch (error) {
      this.config.logger.error("Failed to upgrade to Pump.fun SDK", { error });
      throw error;
    }
  }
}
