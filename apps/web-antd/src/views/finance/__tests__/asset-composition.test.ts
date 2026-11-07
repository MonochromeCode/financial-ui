import type { Account, Dashboard, Summary } from '../../../api/finance/assets';

import { describe, expect, it } from 'vitest';

import {
  buildAssetFlow,
  flowRatio,
  formatFlowAmount,
} from '../asset-composition';
import { cents } from '../shared';

function summary(totalAssets: string, totalLiabilities: string): Summary {
  return { totalAssets, totalLiabilities, netAssets: '', debtRatio: null };
}

function composition(
  amounts: Record<string, string>,
): Dashboard['composition'] {
  return Object.entries(amounts).map(([code, amount], index) => ({
    id: index,
    code,
    name: code,
    amount,
    ratio: '0',
    color: '#3b82f6',
    icon: 'wallet',
    description: '',
    sortOrder: index,
    enabled: true,
  }));
}

describe('资产组成桑基图', () => {
  const account = (
    id: number,
    name: string,
    categoryCode: string,
    balance: null | string,
  ): Account => ({
    id,
    name,
    categoryCode,
    balance,
    memberId: 4,
    templateCode: null,
    fundBucket: null,
    insuranceType: null,
    dataDate: '2026-10-30',
    sortOrder: id,
    remark: '',
  });

  it('按来源、总资产、分类、具体账户四层展开，并保持分类金额守恒', () => {
    const model = buildAssetFlow(
      summary('562000', '0'),
      composition({ liquid: '112000', investment: '450000' }),
      [
        account(1, '银行卡', 'liquid', '62000'),
        account(2, '现金', 'liquid', '50000'),
        account(3, '同花顺', 'investment', '364000'),
        account(4, '华泰', 'investment', '54000'),
        account(5, '支付宝', 'investment', '32000'),
      ],
    );
    expect(model.nodes.filter((node) => node.kind === 'account')).toHaveLength(
      5,
    );
    expect(model.nodes.find((node) => node.name === 'account:3')?.depth).toBe(
      3,
    );
    for (const node of model.nodes.filter((node) => node.kind === 'category')) {
      const outgoing = model.links.filter((link) => link.source === node.name);
      expect(
        outgoing.reduce((total, link) => total + cents(link.amount), 0n),
      ).toBe(cents(node.amount));
    }
    expect(
      model.links.find((link) => link.target === 'account:3')?.source,
    ).toBe('category:investment');
  });

  it('同名账户保持独立，零值、空值、已删除及筛选范围外账户不显示', () => {
    const model = buildAssetFlow(
      summary('30', '0'),
      composition({ liquid: '30' }),
      [
        account(1, '银行卡', 'liquid', '20'),
        account(2, '银行卡', 'liquid', '10'),
        account(3, '未估值', 'liquid', null),
        account(4, '零余额', 'liquid', '0'),
        { ...account(5, '删除账户', 'liquid', '50'), deleted: true },
        account(6, '房产', 'fixed', '100000'),
        account(7, '信用卡', 'liability', '30'),
      ],
    );
    expect(
      model.nodes
        .filter((node) => node.kind === 'account')
        .map((node) => node.name),
    ).toEqual(['account:1', 'account:2']);
  });

  it('万元、亿元按分位精确四舍五入，比例以总资产为基数', () => {
    expect(formatFlowAmount('562000')).toBe('56.20万');
    expect(formatFlowAmount('62000')).toBe('6.20万');
    expect(formatFlowAmount('9999999999999.99')).toBe('100000.00亿');
    expect(formatFlowAmount('2318.01')).toBe('2318.01元');
    expect(flowRatio('62000', '562000')).toBe('11.03%');
    expect(flowRatio('562000', '562000')).toBe('100.00%');
    expect(flowRatio('0', '0')).toBe('--');
  });
  it('资产来源和分类去向都与总资产相等，负债不重复计入资产分类', () => {
    const model = buildAssetFlow(
      summary('100.30', '30.10'),
      composition({ liquid: '70.10', investment: '30.20', liability: '30.10' }),
    );
    const incoming = model.links.filter((link) => link.target === 'total');
    const outgoing = model.links.filter((link) => link.source === 'total');
    for (const links of [incoming, outgoing]) {
      expect(links.reduce((sum, link) => sum + cents(link.amount), 0n)).toBe(
        10_030n,
      );
    }
    expect(model.nodes.find((node) => node.name === 'net')?.amount).toBe(
      '70.20',
    );
    expect(model.nodes.some((node) => node.name === 'category:liability')).toBe(
      false,
    );
  });

  it('负净资产用单独的差额分支展示，保持所有流向非负且守恒', () => {
    const model = buildAssetFlow(
      summary('80.00', '120.00'),
      composition({ liquid: '80.00' }),
    );
    expect(model.shortfall).toBe('40.00');
    expect(model.nodes.some((node) => node.name === 'net')).toBe(false);
    expect(model.links.every((link) => link.value > 0)).toBe(true);
    expect(
      model.links
        .filter((link) => link.source === 'liability')
        .reduce((sum, link) => sum + cents(link.amount), 0n),
    ).toBe(12_000n);
    expect(
      model.links.find((link) => link.target === 'shortfall')?.amount,
    ).toBe('40.00');
  });

  it('空账本与全零余额不创建虚构流向', () => {
    const model = buildAssetFlow(
      summary('0', '0'),
      composition({ liquid: '0' }),
    );
    expect(model.nodes).toEqual([]);
    expect(model.links).toEqual([]);
  });

  it('只有负债时不产生指向不存在的总资产节点的连线', () => {
    const model = buildAssetFlow(
      summary('0', '123.45'),
      composition({ liability: '123.45' }),
    );
    expect(model.links).toHaveLength(1);
    expect(model.links[0]?.amount).toBe('123.45');
    expect(model.nodes.some((node) => node.name === 'total')).toBe(false);
    expect(
      model.links.every(
        (link) =>
          model.nodes.some((node) => node.name === link.source) &&
          model.nodes.some((node) => node.name === link.target),
      ),
    ).toBe(true);
  });

  it('无负债和净资产为零的情形都能形成有效资产流向', () => {
    for (const debt of ['0.00', '20.00']) {
      const model = buildAssetFlow(
        summary('20.00', debt),
        composition({ liquid: '20.00', fixed: '0.00' }),
      );
      expect(
        model.links
          .filter((link) => link.target === 'total')
          .reduce((sum, link) => sum + cents(link.amount), 0n),
      ).toBe(2000n);
      expect(model.nodes.some((node) => node.name === 'category:fixed')).toBe(
        false,
      );
    }
  });

  it('大额资产的净资产与差额计算保留分位精度', () => {
    const model = buildAssetFlow(
      summary('9999999999999.99', '0.01'),
      composition({ fixed: '9999999999999.99' }),
    );
    expect(model.nodes.find((node) => node.name === 'net')?.amount).toBe(
      '9999999999999.98',
    );
  });
});
