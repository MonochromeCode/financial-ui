import { describe, expect, it } from 'vitest';

import { calculateGrid, readStrategies, validateGrid } from '../grid';

const sample = {
  name: '云铝',
  triggerPrice: '26.1',
  gridAmount: '2610',
  buyStrategy: 'equal' as const,
  increasePercent: '10',
  gridPercent: '5',
  stressPercent: '30',
  mediumLargeEnabled: false,
  mediumPercent: '15',
  largePercent: '30',
};

describe('网格策略测算', () => {
  it('复现截图中的七档价格、盈利与压力测试汇总', () => {
    const result = calculateGrid(sample);
    expect(result.rows).toHaveLength(7);
    expect(result.rows.map((row) => row.buyPrice)).toEqual([
      26.1, 24.795, 23.49, 22.185, 20.88, 19.575, 18.27,
    ]);
    expect(result.rows[0]?.sellPrice).toBe(27.405);
    expect(result.rows[1]?.profit).toBe(130.5);
    expect(result.rows[1]?.profitPercent).toBeCloseTo(5.26, 2);
    expect(result.totalInvestment).toBe(15_529.5);
    expect(result.floatingLoss).toBe(2740.5);
    expect(result.boughtGrids).toBe(7);
    expect(result.totalShares).toBe(700);
  });

  it('每档独立预算向下取整到一手，跌幅不整除时按实际终点算浮亏', () => {
    const result = calculateGrid({
      ...sample,
      gridAmount: '3000',
      stressPercent: '12',
    });
    expect(result.rows.map((row) => row.shares)).toEqual([100, 100, 100]);
    expect(result.endPrice).toBe(22.968);
    expect(result.floatingLoss).toBeCloseTo(548.1, 2);
  });

  it('逐格加码按每个网格系列的序号线性增加预算', () => {
    const result = calculateGrid({
      ...sample,
      buyStrategy: 'progressive',
      increasePercent: '50',
    });
    expect(result.rows.slice(0, 3).map((row) => row.budget)).toEqual([
      2610, 3915, 5220,
    ]);
    expect(result.rows.slice(0, 3).map((row) => row.shares)).toEqual([
      100, 100, 200,
    ]);
    expect(result.totalShares).toBeGreaterThan(700);
  });

  it('中网和大网按独立价差计算，重合档位分别买入并累计', () => {
    const result = calculateGrid({ ...sample, mediumLargeEnabled: true });
    expect(result.rows).toHaveLength(12);
    expect(result.rows.slice(0, 3).map((row) => row.type)).toEqual([
      'small',
      'medium',
      'large',
    ]);
    expect(result.rows.filter((row) => row.buyPrice === 18.27)).toHaveLength(3);
    expect(result.boughtGrids).toBe(12);
    expect(result.totalShares).toBe(1200);
    expect(result.totalInvestment).toBe(26_622);
    expect(result.floatingLoss).toBe(4698);
  });

  it('旧版保存的等额买入策略会补上新字段', () => {
    const legacy = {
      id: 'old',
      updatedAt: '2026-11-07T00:00:00.000Z',
      name: sample.name,
      triggerPrice: sample.triggerPrice,
      gridAmount: sample.gridAmount,
      gridPercent: sample.gridPercent,
      stressPercent: sample.stressPercent,
    };
    const storage = { getItem: () => JSON.stringify([legacy]) };
    const [strategy] = readStrategies(storage, 'key');
    expect(strategy?.buyStrategy).toBe('equal');
    expect(strategy?.mediumLargeEnabled).toBe(false);
    expect(strategy?.mediumPercent).toBe('15');
    expect(strategy?.largePercent).toBe('30');
    expect(calculateGrid(strategy!).totalInvestment).toBe(15_529.5);
  });

  it('跳过可选字段类型错误的本地策略', () => {
    const storage = {
      getItem: () =>
        JSON.stringify([
          { ...sample, id: 'bad', updatedAt: 'now', mediumPercent: 15 },
        ]),
    };
    expect(readStrategies(storage, 'key')).toEqual([]);
  });

  it('拒绝零间距、买不起一手和超过档位上限的输入', () => {
    expect(
      validateGrid({ ...sample, gridPercent: '0' }).gridPercent,
    ).toBeTruthy();
    expect(
      validateGrid({ ...sample, gridAmount: '2600' }).gridAmount,
    ).toBeTruthy();
    expect(
      validateGrid({ ...sample, gridPercent: '0.01' }).gridPercent,
    ).toBeTruthy();
    expect(
      validateGrid({
        ...sample,
        buyStrategy: 'progressive',
        increasePercent: '0',
      }).increasePercent,
    ).toBeTruthy();
    expect(
      validateGrid({ ...sample, mediumLargeEnabled: true, mediumPercent: '5' })
        .mediumPercent,
    ).toBeTruthy();
  });
});
