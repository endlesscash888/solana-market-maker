import { Connection } from "@solana/web3.js";
import { Redis } from "ioredis";
import winston from "winston";

export interface TradingConfig {
  connection: Connection;
  rpcEndpoint: string;
  maxPositionSize: number;
  minOrderSize: number;
  maxSlippage: number;
  orderRefreshInterval: number;
  emergencyStopLoss: number;
}

export interface TradingEngineConfig extends TradingConfig {
  redis: Redis;
  logger: winston.Logger;
}
