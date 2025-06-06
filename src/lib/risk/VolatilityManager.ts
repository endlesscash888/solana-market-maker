// VolatilityManager.ts
import axios from 'axios';
import { BotConfigManager } from '../config/BotConfig.js';

const VIX_API = 'https://api.polygon.io/v2/aggs/ticker/I:VIX/prev';

export class VolatilityManager {
  private readonly apiKey: string;
  private vixCache: number = 20; // Default VIX

  constructor() {
    this.apiKey = BotConfigManager.getInstance().getConfig().security.heliusApiKey;
    setInterval(this.updateVIX.bind(this), 300_000); // Каждые 5 минут
  }

  private async updateVIX(): Promise<void> {
    try {
      const { data } = await axios.get(VIX_API, {
        params: { apiKey: this.apiKey }
      });
      this.vixCache = data.results[0].c; // Closing value
    } catch (err) {
      console.error('VIX update failed:', err);
    }
  }

  getSpreadMultiplier(): number {
    return Math.min(1 + (this.vixCache ** 2) / 100, 3); // VIX² / 100 с макс. x3
  }
}
