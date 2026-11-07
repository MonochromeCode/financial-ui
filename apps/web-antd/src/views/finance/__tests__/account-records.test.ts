import type { AccountSnapshots, Member } from '../../../api/finance/assets';

import { createApp, h, nextTick, ref } from 'vue';

import { afterEach, expect, it } from 'vitest';

import AssetAccountRecords from '../asset-account-records.vue';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  document.body.innerHTML = '';
});

it('展示全部历史日期、独立账户表头，并区分零、空余额和缺失账户，响应隐私切换', async () => {
  const hidden = ref(false);
  const members: Member[] = [1, 2].map((id) => ({
    id,
    userId: null,
    displayName: `成员${id}`,
    role: 'member',
    sortOrder: id,
  }));
  const records: AccountSnapshots = {
    columns: [1, 2, 3].map((id) => ({
      id: String(id),
      name: id === 3 ? '支付宝' : '银行卡',
      memberId: id === 2 ? 2 : 1,
      categoryCode: 'liquid',
    })),
    rows: ['2026-11-07', '2021-02-17'].map((date) => ({
      date,
      amounts: { '1': '0.00', '2': null },
      totalAssets: '1234.56',
      totalLiabilities: '0.00',
      netAssets: '1234.56',
    })),
  };
  const container = document.createElement('div');
  document.body.append(container);
  const app = createApp(() =>
    h(AssetAccountRecords, {
      records,
      members,
      categories: [],
      hidden: hidden.value,
    }),
  );
  app.mount(container);
  unmount = () => app.unmount();
  const headers = [...container.querySelectorAll('thead th')].map(
    (item) => item.textContent,
  );
  expect(headers).toEqual([
    '记录日期',
    '银行卡 成员1',
    '银行卡 成员2',
    '支付宝 成员1',
    '总资产',
    '总负债',
    '净资产',
  ]);
  expect(
    [...container.querySelectorAll('time')].map((item) => item.dateTime),
  ).toEqual(['2026-11-07', '2021-02-17']);
  expect(
    [...container.querySelectorAll('tbody tr:first-child td')].map(
      (item) => item.textContent,
    ),
  ).toEqual([
    '0.00 元',
    '待填写',
    '—',
    '1,234.56 元',
    '0.00 元',
    '1,234.56 元',
  ]);
  hidden.value = true;
  await nextTick();
  expect(container.textContent).not.toContain('1,234.56');
  expect(container.textContent).not.toContain('待填写');
  expect(container.querySelectorAll('tbody td')[0]?.textContent).toBe(
    '**** 元',
  );
  expect(container.querySelectorAll('tbody td')[2]?.textContent).toBe('—');
});
