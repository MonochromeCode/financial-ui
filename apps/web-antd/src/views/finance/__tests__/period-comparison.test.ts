import type { Snapshot } from '../../../api/finance/assets';

import { createApp, h, nextTick, ref } from 'vue';

import { afterEach, describe, expect, it } from 'vitest';

import AssetPeriodComparison from '../asset-period-comparison.vue';
import { compareAmounts, periodSnapshots } from '../period-comparison';

function snapshot(date: string, totalAssets: string): Snapshot {
  return {
    date,
    totalAssets,
    totalLiabilities: '100.00',
    netAssets: totalAssets,
    debtRatio: null,
    amounts: { liquid: totalAssets },
  };
}

const snapshots = [
  snapshot('2025-12-31', '1000.00'),
  snapshot('2026-01-01', '2000.00'),
  snapshot('2026-01-31', '2500.00'),
  snapshot('2026-03-07', '3000.00'),
];
let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  unmount = undefined;
  document.body.innerHTML = '';
});

describe('资产周期对比', () => {
  it('按各期最后记录取值，跨年分组，不累加也不填补无记录月份', () => {
    const unsorted = snapshots.toReversed();
    expect(
      periodSnapshots(unsorted, 'month').map((item) => [
        item.period,
        item.snapshot.totalAssets,
      ]),
    ).toEqual([
      ['2026-03', '3000.00'],
      ['2026-01', '2500.00'],
      ['2025-12', '1000.00'],
    ]);
    expect(
      periodSnapshots(unsorted, 'year').map((item) => item.snapshot.date),
    ).toEqual(['2026-03-07', '2025-12-31']);
    expect(periodSnapshots([], 'month')).toEqual([]);
  });

  it('以分为单位计算增减，处理持平、零基准和负净资产', () => {
    expect(compareAmounts('0.30', '0.10')).toEqual({
      amount: '0.20',
      direction: 'up',
      rate: '+200.00%',
    });
    expect(compareAmounts('2.00', '3.00')).toEqual({
      amount: '-1.00',
      direction: 'down',
      rate: '-33.33%',
    });
    expect(compareAmounts('3.00', '3.00').rate).toBe('0.00%');
    expect(compareAmounts('100.00', '0.00').rate).toBeNull();
    expect(compareAmounts('-50.00', '-100.00')).toEqual({
      amount: '50.00',
      direction: 'up',
      rate: null,
    });
    expect(
      compareAmounts('999999999999999.99', '999999999999999.98').amount,
    ).toBe('0.01');
  });

  it('支持月度、年度切换和选期，并随隐私开关和成员数据更新', async () => {
    const data = ref(snapshots);
    const hidden = ref(false);
    const container = document.createElement('div');
    document.body.append(container);
    const app = createApp(() =>
      h(AssetPeriodComparison, {
        snapshots: data.value,
        categories: [],
        hidden: hidden.value,
      }),
    );
    app.mount(container);
    unmount = () => app.unmount();
    expect(container.textContent).toContain('+500.00 元');
    expect(container.textContent).toContain('+20.00%');

    container
      .querySelectorAll<HTMLButtonElement>('.comparison-tabs button')[1]!
      .click();
    await nextTick();
    expect(container.textContent).toContain('+2,000.00 元');
    expect(container.textContent).toContain('+200.00%');
    const select = container.querySelector<HTMLSelectElement>(
      '[aria-label="对比期"]',
    )!;
    select.value = '2025';
    select.dispatchEvent(new Event('change'));
    await nextTick();
    expect(container.textContent).toContain('当前选择了同一时期');
    expect(container.textContent).toContain('0.00 元');

    hidden.value = true;
    await nextTick();
    expect(container.textContent).toContain('**** 元');
    expect(container.textContent).not.toContain('1,000.00');
    expect(container.querySelector('.up, .down')).toBeNull();

    data.value = [snapshot('2024-02-10', '500.00')];
    await nextTick();
    expect(container.textContent).toContain('暂无可对比的年份');
    expect(container.textContent).not.toContain('2026');
    data.value = [];
    await nextTick();
    expect(container.textContent).toContain('暂无资产记录');
    expect(container.querySelector('.comparison-metrics')).toBeNull();
  });
});
