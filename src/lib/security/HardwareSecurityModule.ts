// HardwareSecurityModule.ts
import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
import Solana from '@ledgerhq/hw-app-solana';
import { Keypair, Transaction } from '@solana/web3.js';

export class HardwareSecurityModule {
  private transport: TransportWebUSB | null = null;
  private solanaApp: Solana | null = null;

  async connect(): Promise<void> {
    this.transport = await TransportWebUSB.create();
    this.solanaApp = new Solana(this.transport);
  }

  async signTransaction(
    tx: Transaction,
    derivationPath: string = "44'/501'/0'/0'"
  ): Promise<Transaction> {
    if (!this.solanaApp) throw new Error('HSM not connected');
    
    const msg = tx.serializeMessage();
    const { signature } = await this.solanaApp.signTransaction(
      derivationPath,
      msg
    );
    
    tx.addSignature(Keypair.fromSecretKey(Buffer.from(signature)).publicKey, signature);
    return tx;
  }

  async disconnect(): Promise<void> {
    await this.transport?.close();
  }
}
