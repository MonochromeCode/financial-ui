import type { Account, Dashboard, Summary } from '#/api/finance/assets';

import { cents, decimal } from './shared';

export interface AssetFlowNode {
  name: string;
  title: string;
  amount: string;
  depth: number;
  kind: 'account' | 'category' | 'shortfall' | 'source' | 'total';
  itemStyle: { color: string };
  label: { position: 'left' | 'right' | 'top' };
}

export function formatFlowAmount(amount: string) {
  const value = cents(amount);
  for (const [unit, suffix] of [
    [10_000_000_000n, '亿'],
    [1_000_000n, '万'],
  ] as const) {
    if (value >= unit)
      return `${decimal((value * 100n + unit / 2n) / unit)}${suffix}`;
  }
  return `${decimal(value)}元`;
}

export function flowRatio(amount: string, base: string) {
  const total = cents(base);
  return total > 0n
    ? `${decimal((cents(amount) * 10_000n + total / 2n) / total)}%`
    : '--';
}

export interface AssetFlowLink {
  source: string;
  target: string;
  value: number;
  amount: string;
}

export function buildAssetFlow(
  summary: Summary,
  composition: Dashboard['composition'],
  accounts?: Account[],
) {
  const nodes: AssetFlowNode[] = [];
  const links: AssetFlowLink[] = [];
  const total = cents(summary.totalAssets);
  const liability = cents(summary.totalLiabilities);
  const net = total - liability;
  const shortfall = net < 0n ? -net : 0n;
  const addNode = (
    name: string,
    title: string,
    amount: bigint,
    depth: number,
    color: string,
    position: AssetFlowNode['label']['position'],
    kind: AssetFlowNode['kind'],
  ) => {
    nodes.push({
      name,
      title,
      amount: decimal(amount),
      depth,
      kind,
      itemStyle: { color },
      label: { position },
    });
  };
  const addLink = (source: string, target: string, amount: bigint) => {
    if (amount <= 0n) return;
    links.push({
      source,
      target,
      value: Number(decimal(amount)),
      amount: decimal(amount),
    });
  };
  if (total > 0n) {
    addNode('total', '总资产', total, 1, '#9792b8', 'top', 'total');
    if (net > 0n) {
      addNode('net', '净资产', net, 0, '#58bea3', 'left', 'source');
      addLink('net', 'total', net);
    }
    for (const category of composition) {
      const amount = cents(category.amount);
      if (category.code === 'liability' || amount <= 0n) continue;
      const name = `category:${category.code}`;
      const color =
        (
          { liquid: '#ca8e6b', investment: '#9380b5' } as Record<string, string>
        )[category.code] || category.color;
      addNode(
        name,
        category.name,
        amount,
        2,
        color,
        accounts ? 'left' : 'right',
        'category',
      );
      addLink('total', name, amount);
      const items = (accounts || [])
        .filter(
          (account) =>
            !account.deleted &&
            account.categoryCode === category.code &&
            cents(account.balance) > 0n,
        )
        .toSorted((first, second) => {
          const difference = cents(second.balance) - cents(first.balance);
          if (difference > 0n) return 1;
          if (difference < 0n) return -1;
          return first.sortOrder - second.sortOrder;
        });
      for (const [index, account] of items.entries()) {
        const accountName = `account:${account.id ?? `${account.memberId}:${category.code}:${index}`}`;
        const balance = cents(account.balance);
        addNode(
          accountName,
          account.name,
          balance,
          3,
          color,
          'right',
          'account',
        );
        addLink(name, accountName, balance);
      }
    }
  }
  if (liability > 0n) {
    addNode('liability', '总负债', liability, 0, '#ef8d92', 'left', 'source');
    addLink('liability', 'total', total < liability ? total : liability);
    if (shortfall > 0n) {
      addNode(
        'shortfall',
        '资不抵债差额',
        shortfall,
        1,
        '#e9a56d',
        'right',
        'shortfall',
      );
      addLink('liability', 'shortfall', shortfall);
    }
  }
  return { nodes, links, shortfall: decimal(shortfall) };
}
