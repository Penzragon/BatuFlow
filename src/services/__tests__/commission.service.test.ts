import { describe, it, expect } from "vitest";
import { applyTieredRate } from "../commission.service";

describe("commission.service", () => {
  describe("applyTieredRate", () => {
    it("returns 0 when totalSales is 0", () => {
      const tiers = [{ minAmount: 0, maxAmount: 100_000_000, rate: 3 }];
      expect(applyTieredRate(tiers, 0)).toBe(0);
    });

    it("applies single tier correctly", () => {
      const tiers = [{ minAmount: 0, maxAmount: 100_000_000, rate: 3 }];
      expect(applyTieredRate(tiers, 50_000_000)).toBe(1_500_000);
    });

    it("applies multiple tiers correctly", () => {
      const tiers = [
        { minAmount: 0, maxAmount: 100_000_000, rate: 3 },
        { minAmount: 100_000_000, maxAmount: null, rate: 5 },
      ];
      // 100M at 3% = 3M, 50M at 5% = 2.5M, total 5.5M
      expect(applyTieredRate(tiers, 150_000_000)).toBe(5_500_000);
    });

    it("handles open-ended last tier (null maxAmount)", () => {
      const tiers = [{ minAmount: 0, maxAmount: null, rate: 4 }];
      expect(applyTieredRate(tiers, 200_000_000)).toBe(8_000_000);
    });
  });
});
