import type { Snapshot } from '#/api/finance/assets';

import { cents, decimal } from './shared';

export type ComparisonMode = 'month' | 'year';

export function periodSnapshots(snapshots: Snapshot[], mode: ComparisonMode) {
  const periods = new Map<string, Snapshot>();
  for (const snapshot of snapshots) {
    const period = snapshot.date.slice(0, mode === 'month' ? 7 : 4);
    const previous = periods.get(period);
    if (!previous || snapshot.date > previous.date)
      periods.set(period, snapshot);
  }
  return [...periods.entries()]
    .map(([period, snapshot]) => ({ period, snapshot }))
    .toSorted((first, second) => second.period.localeCompare(first.period));
}

export function compareAmounts(current: string, baseline: string) {
  const previous = cents(baseline);
  const difference = cents(current) - previous;
  const magnitude = difference < 0n ? -difference : difference;
  const hundredths =
    previous > 0n ? (magnitude * 10_000n + previous / 2n) / previous : null;
  let direction = 'flat';
  let sign = '';
  if (difference > 0n) {
    direction = 'up';
    sign = '+';
  } else if (difference < 0n) {
    direction = 'down';
    sign = '-';
  }
  return {
    amount: decimal(difference),
    direction,
    rate: hundredths === null ? null : `${sign}${decimal(hundredths)}%`,
  };
}
