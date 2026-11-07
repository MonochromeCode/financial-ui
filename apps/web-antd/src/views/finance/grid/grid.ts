export interface GridForm {
  name: string;
  triggerPrice: string;
  gridAmount: string;
  buyStrategy: 'equal' | 'progressive';
  increasePercent: string;
  gridPercent: string;
  stressPercent: string;
  mediumLargeEnabled: boolean;
  mediumPercent: string;
  largePercent: string;
}

export interface GridStrategy extends GridForm {
  id: string;
  updatedAt: string;
}

export interface GridRow {
  type: 'large' | 'medium' | 'small';
  level: number;
  buyPrice: number;
  sellPrice: number;
  budget: number;
  shares: number;
  profit: number;
  profitPercent: number;
}

export interface GridResult {
  rows: GridRow[];
  totalInvestment: number;
  floatingLoss: number;
  totalShares: number;
  boughtGrids: number;
  endPrice: number;
}

export type GridErrors = Partial<Record<keyof GridForm, string>>;

const decimalPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const priceScale = 1_000_000;
const percentScale = 10_000;
const lotSize = 100;
const maxGrids = 200;
const gridOrder = { small: 0, medium: 1, large: 2 };

function scaled(value: string): number {
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

function validDecimal(value: string, max: number, allowZero = false): boolean {
  return (
    decimalPattern.test(value) &&
    Number(value) <= max &&
    (allowZero || Number(value) > 0)
  );
}

export function validateGrid(form: GridForm): GridErrors {
  const errors: GridErrors = {};
  if (!form.name.trim()) errors.name = '请输入策略名称';
  else if (form.name.trim().length > 40) errors.name = '名称不能超过 40 个字符';
  if (!validDecimal(form.triggerPrice, 1_000_000)) {
    errors.triggerPrice = '请输入大于 0、最多两位小数的价格（不超过 100 万元）';
  }
  if (!validDecimal(form.gridAmount, 1_000_000)) {
    errors.gridAmount = '请输入大于 0、最多两位小数的金额（不超过 100 万元）';
  }
  if (form.buyStrategy !== 'equal' && form.buyStrategy !== 'progressive') {
    errors.buyStrategy = '请选择买入策略';
  }
  if (
    form.buyStrategy === 'progressive' &&
    !validDecimal(form.increasePercent, 100)
  ) {
    errors.increasePercent = '请输入大于 0 且不超过 100 的加码比例';
  }
  if (!validDecimal(form.gridPercent, 99.99)) {
    errors.gridPercent = '请输入大于 0 且小于 100 的百分比，最多两位小数';
  }
  if (!validDecimal(form.stressPercent, 99.99, true)) {
    errors.stressPercent = '请输入 0 至 99.99 的百分比，最多两位小数';
  }
  if (
    !errors.triggerPrice &&
    !errors.gridAmount &&
    scaled(form.gridAmount) < scaled(form.triggerPrice) * lotSize
  ) {
    errors.gridAmount = '网格金额至少要能在触发价格买入 100 股';
  }
  if (form.mediumLargeEnabled) {
    if (!validDecimal(form.mediumPercent, 99.99)) {
      errors.mediumPercent = '请输入大于 0 且小于 100 的中网大小';
    }
    if (!validDecimal(form.largePercent, 99.99)) {
      errors.largePercent = '请输入大于 0 且小于 100 的大网大小';
    }
    if (
      !errors.gridPercent &&
      !errors.mediumPercent &&
      scaled(form.mediumPercent) <= scaled(form.gridPercent)
    ) {
      errors.mediumPercent = '中网大小必须大于小网大小';
    }
    if (
      !errors.mediumPercent &&
      !errors.largePercent &&
      scaled(form.largePercent) <= scaled(form.mediumPercent)
    ) {
      errors.largePercent = '大网大小必须大于中网大小';
    }
  }
  if (
    !errors.gridPercent &&
    !errors.stressPercent &&
    !errors.mediumPercent &&
    !errors.largePercent
  ) {
    const stress = scaled(form.stressPercent);
    const gaps = [scaled(form.gridPercent)];
    if (form.mediumLargeEnabled)
      gaps.push(scaled(form.mediumPercent), scaled(form.largePercent));
    const count = gaps.reduce(
      (total, gap) => total + Math.floor(stress / gap) + 1,
      0,
    );
    if (count > maxGrids)
      errors.gridPercent =
        '当前参数超过 200 档，请增大网格大小或降低压力测试幅度';
  }
  return errors;
}

export function calculateGrid(form: GridForm): GridResult {
  if (Object.keys(validateGrid(form)).length > 0) {
    throw new Error('网格策略参数无效');
  }
  const baseCents = scaled(form.triggerPrice);
  const budgetCents = scaled(form.gridAmount);
  const stress = scaled(form.stressPercent);
  const increase =
    form.buyStrategy === 'progressive' ? scaled(form.increasePercent) : 0;
  const grids = [
    { type: 'small' as const, gap: scaled(form.gridPercent) },
    ...(form.mediumLargeEnabled
      ? [
          { type: 'medium' as const, gap: scaled(form.mediumPercent) },
          { type: 'large' as const, gap: scaled(form.largePercent) },
        ]
      : []),
  ];
  const rows: GridRow[] = [];
  let investmentCents = 0;
  let endValueCents = 0;
  let totalShares = 0;
  let boughtGrids = 0;
  const endUnits = baseCents * (percentScale - stress);

  for (const grid of grids) {
    const count = Math.floor(stress / grid.gap) + 1;
    for (let index = 0; index < count; index++) {
      const levelUnits = percentScale - index * grid.gap;
      const buyUnits = baseCents * levelUnits;
      const sellUnits = buyUnits + baseCents * grid.gap;
      const budgetMultiplier = percentScale + index * increase;
      const shares =
        Math.floor((budgetCents * budgetMultiplier) / (buyUnits * lotSize)) *
        lotSize;
      const profitUnits = (sellUnits - buyUnits) * shares;
      investmentCents += Math.round((buyUnits * shares) / 10_000);
      endValueCents += Math.round((endUnits * shares) / 10_000);
      totalShares += shares;
      if (shares > 0) boughtGrids++;
      rows.push({
        type: grid.type,
        level: levelUnits / percentScale,
        buyPrice: buyUnits / priceScale,
        sellPrice: sellUnits / priceScale,
        budget: (budgetCents * budgetMultiplier) / percentScale / 100,
        shares,
        profit: profitUnits / priceScale,
        profitPercent: ((sellUnits - buyUnits) / buyUnits) * 100,
      });
    }
  }

  rows.sort(
    (left, right) =>
      right.buyPrice - left.buyPrice ||
      gridOrder[left.type] - gridOrder[right.type],
  );
  return {
    rows,
    totalInvestment: investmentCents / 100,
    floatingLoss: (investmentCents - endValueCents) / 100,
    totalShares,
    boughtGrids,
    endPrice: endUnits / priceScale,
  };
}

export function readStrategies(
  storage: Pick<Storage, 'getItem'>,
  key: string,
): GridStrategy[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(key) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item: unknown) => {
      if (item === null || typeof item !== 'object') return [];
      const record = item as Record<string, unknown>;
      if (
        typeof record.id !== 'string' ||
        typeof record.updatedAt !== 'string' ||
        typeof record.name !== 'string' ||
        typeof record.triggerPrice !== 'string' ||
        typeof record.gridAmount !== 'string' ||
        typeof record.gridPercent !== 'string' ||
        typeof record.stressPercent !== 'string' ||
        (record.buyStrategy !== undefined &&
          typeof record.buyStrategy !== 'string') ||
        (record.increasePercent !== undefined &&
          typeof record.increasePercent !== 'string') ||
        (record.mediumLargeEnabled !== undefined &&
          typeof record.mediumLargeEnabled !== 'boolean') ||
        (record.mediumPercent !== undefined &&
          typeof record.mediumPercent !== 'string') ||
        (record.largePercent !== undefined &&
          typeof record.largePercent !== 'string')
      )
        return [];
      const strategy = {
        ...record,
        buyStrategy: record.buyStrategy ?? 'equal',
        increasePercent: record.increasePercent ?? '10',
        mediumLargeEnabled: record.mediumLargeEnabled ?? false,
        mediumPercent: record.mediumPercent ?? '15',
        largePercent: record.largePercent ?? '30',
      } as GridStrategy;
      return Object.keys(validateGrid(strategy)).length === 0 ? [strategy] : [];
    });
  } catch {
    return [];
  }
}
