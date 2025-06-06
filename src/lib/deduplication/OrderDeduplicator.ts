// OrderDeduplicator.ts
import { createClient, RedisClientType } from 'redis';
import { BloomFilter } from '@redis/bloom';
import { BotConfigManager } from '../config/BotConfig.js';

export class OrderDeduplicator {
  private bloom: BloomFilter;
  private redis: RedisClientType;
  private readonly config: ReturnType<BotConfigManager['getConfig']>;

  constructor() {
    this.config = BotConfigManager.getInstance().getConfig();
    this.redis = createClient({ url: this.config.redis.url });
    this.bloom = new BloomFilter(this.redis, 'order_dedup_bloom');
  }

  async init(): Promise<void> {
    await this.redis.connect();
    await this.bloom.reserve(
      0.0001,    // 0.01% false positive rate
      1000000,   // 1M элементов
      {
        expansionRate: 2, // Автомасштабирование фильтра
      }
    );
  }

  async checkDuplicate(orderId: string): Promise<boolean> {
    return this.bloom.exists(orderId);
  }

  async markProcessed(orderId: string): Promise<void> {
    await this.bloom.add(orderId);
    await this.redis.expire('order_dedup_bloom', 86400); // TTL 24ч
  }
}
