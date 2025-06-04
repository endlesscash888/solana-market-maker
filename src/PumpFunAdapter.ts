import { PumpAmmSdk } from '@pump-fun/pump-sdk@1.3.8';
import { Connection, PublicKey } from '@solana/web3.js';

interface SwapParams {
  mint: string;
  amount: number;
  direction: 'buy' | 'sell';
  poolId: string;
}

export class PumpFunAdapter {
  private sdk: PumpAmmSdk;

  constructor(connection: Connection) {
    this.sdk = new PumpAmmSdk({ connection });
  }

  async createSwap(params: SwapParams) {
    const { tx } = await this.sdk.createSwapInstructions({
      mint: new PublicKey(params.mint),
      amount: params.amount,
      direction: params.direction,
      poolId: params.poolId
    });
    return tx;
  }

  async getBondingCurveState(poolId: string) {
    return await this.sdk.getBondingCurveState(poolId);
  }
}
