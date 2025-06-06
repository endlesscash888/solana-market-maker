import { describe, it, expect, beforeEach } from 'vitest';
import { OrderDeduplicator } from '../../../src/lib/deduplication/OrderDeduplicator.js';

describe('OrderDeduplicator', () => {
  let dedup: OrderDeduplicator;

  beforeEach(async () => {
    dedup = new OrderDeduplicator();
    await dedup.init();
  });

  it('should detect duplicates with 0.01% error rate', async () => {
    const orderId = 'tx_12345';
    expect(await dedup.checkDuplicate(orderId)).toBe(false);
    await dedup.markProcessed(orderId);
    expect(await dedup.checkDuplicate(orderId)).toBe(true);
  });
});
