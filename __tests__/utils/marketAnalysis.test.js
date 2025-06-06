// __tests__/utils/marketAnalysis.test.js
import { describe, it, expect } from 'vitest';
import { calculateVolatility } from '../../src/utils/marketAnalysis.js';
import { Connection } from '@solana/web3.js';

describe('MarketAnalysis', () => {
  it('should calculate volatility successfully', async () => {
    const mockConnection = new Connection('https://api.mainnet-beta.solana.com');
    const volatility = await calculateVolatility('TokenAddress123', mockConnection);
    expect(volatility).toBeGreaterThanOrEqual(0);
    expect(volatility).toBeLessThanOrEqual(0.5); // Based on simulation range
  });
});
