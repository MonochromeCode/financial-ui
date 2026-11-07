<script setup lang="ts">
import type { ComparisonMode } from './period-comparison';

import type { Category, Snapshot } from '#/api/finance/assets';

import { computed, ref, watch } from 'vue';

import { compareAmounts, periodSnapshots } from './period-comparison';
import { formatMoney } from './shared';

const props = defineProps<{
  snapshots: Snapshot[];
  categories: Category[];
  hidden: boolean;
}>();
const mode = ref<ComparisonMode>('month');
const currentPeriod = ref('');
const baselinePeriod = ref('');
const periods = computed(() => periodSnapshots(props.snapshots, mode.value));
const current = computed(
  () =>
    periods.value.find((item) => item.period === currentPeriod.value)?.snapshot,
);
const baseline = computed(
  () =>
    periods.value.find((item) => item.period === baselinePeriod.value)
      ?.snapshot,
);
const metrics = [
  { key: 'totalAssets', label: '总资产' },
  { key: 'totalLiabilities', label: '总负债' },
  { key: 'netAssets', label: '净资产' },
] as const;
const rows = computed(() =>
  props.categories.map((category) => ({
    code: category.code,
    label: category.name,
    current: current.value?.amounts[category.code] ?? '0.00',
    baseline: baseline.value?.amounts[category.code] ?? '0.00',
  })),
);
const money = (value: string) => formatMoney(value, props.hidden);
const periodLabel = (period: string) => {
  const [year, month] = period.split('-');
  return month ? `${year}年${Number(month)}月` : `${year}年`;
};
const amountChange = (currentValue: string, baselineValue: string) => {
  if (props.hidden) return '**** 元';
  const result = compareAmounts(currentValue, baselineValue);
  return `${result.direction === 'up' ? '+' : ''}${money(result.amount)}`;
};
const rateChange = (currentValue: string, baselineValue: string) => {
  if (props.hidden) return '****';
  return compareAmounts(currentValue, baselineValue).rate ?? '—';
};
const direction = (currentValue: string, baselineValue: string) =>
  props.hidden ? '' : compareAmounts(currentValue, baselineValue).direction;

watch(
  [mode, periods],
  () => {
    currentPeriod.value = periods.value[0]?.period ?? '';
    baselinePeriod.value = periods.value[1]?.period ?? '';
  },
  { immediate: true },
);
</script>

<template>
  <section class="asset-card full-width period-comparison">
    <div class="section-heading comparison-heading">
      <h2>资产对比<small>按月、按年查看资产变化</small></h2>
      <div class="comparison-tabs" role="group" aria-label="对比周期">
        <button :aria-pressed="mode === 'month'" @click="mode = 'month'">
          月度对比
        </button>
        <button :aria-pressed="mode === 'year'" @click="mode = 'year'">
          年度对比
        </button>
      </div>
    </div>
    <template v-if="periods.length">
      <div class="filters comparison-filters">
        <label>
          对比期
          <select v-model="currentPeriod" aria-label="对比期">
            <option
              v-for="item in periods"
              :key="item.period"
              :value="item.period"
            >
              {{ periodLabel(item.period) }}
            </option>
          </select>
        </label>
        <span class="muted">对比</span>
        <label>
          基准期
          <select v-model="baselinePeriod" aria-label="基准期">
            <option v-if="!baselinePeriod" value="" disabled>
              暂无其他时期
            </option>
            <option
              v-for="item in periods"
              :key="item.period"
              :value="item.period"
            >
              {{ periodLabel(item.period) }}
            </option>
          </select>
        </label>
      </div>
      <p class="muted comparison-note">
        每期取最后一次记录的资产余额，不累加期内金额。
        <template v-if="current && baseline">
          实际记录：{{ current.date }} 对比 {{ baseline.date }}。
        </template>
        <template v-else-if="current">实际记录：{{ current.date }}。</template>
      </p>
      <template v-if="current && baseline">
        <p
          v-if="currentPeriod === baselinePeriod"
          class="muted comparison-note"
        >
          当前选择了同一时期，可切换时期查看变化。
        </p>
        <div class="comparison-metrics">
          <article
            v-for="metric in metrics"
            :key="metric.key"
            class="comparison-metric"
          >
            <h3>{{ metric.label }}</h3>
            <strong
              :class="direction(current[metric.key], baseline[metric.key])"
            >
              {{ amountChange(current[metric.key], baseline[metric.key]) }}
            </strong>
            <span
              class="comparison-rate"
              :class="direction(current[metric.key], baseline[metric.key])"
            >
              变化率 {{ rateChange(current[metric.key], baseline[metric.key]) }}
            </span>
            <dl>
              <div>
                <dt>对比期</dt>
                <dd>{{ money(current[metric.key]) }}</dd>
              </div>
              <div>
                <dt>基准期</dt>
                <dd>{{ money(baseline[metric.key]) }}</dd>
              </div>
            </dl>
          </article>
        </div>
        <details class="comparison-details">
          <summary>查看分类对比</summary>
          <div class="month-snapshots">
            <table aria-label="资产分类周期对比">
              <thead>
                <tr>
                  <th scope="col">资产分类</th>
                  <th scope="col">{{ periodLabel(currentPeriod) }}</th>
                  <th scope="col">{{ periodLabel(baselinePeriod) }}</th>
                  <th scope="col">变化金额</th>
                  <th scope="col">变化率</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in rows" :key="row.code">
                  <th scope="row">{{ row.label }}</th>
                  <td>{{ money(row.current) }}</td>
                  <td>{{ money(row.baseline) }}</td>
                  <td :class="direction(row.current, row.baseline)">
                    {{ amountChange(row.current, row.baseline) }}
                  </td>
                  <td>{{ rateChange(row.current, row.baseline) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
        <p class="muted comparison-footnote">
          变化 = 对比期 − 基准期；基准金额为零或负数时不计算变化率。
        </p>
      </template>
      <div v-else class="comparison-empty">
        暂无可对比的{{ mode === 'month' ? '月份' : '年份' }}，记录至少两个{{
          mode === 'month' ? '月份' : '年份'
        }}后即可查看变化。
      </div>
    </template>
    <div v-else class="comparison-empty">
      暂无资产记录，更新资产后即可查看月度和年度对比。
    </div>
  </section>
</template>

<style scoped>
.comparison-heading,
.comparison-filters,
.comparison-filters label {
  flex-wrap: wrap;
}

.comparison-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--asset-bg);
  border-radius: 10px;
}

.comparison-tabs button {
  padding: 7px 14px;
  font-size: 12px;
  color: var(--asset-muted);
  border-radius: 7px;
}

.comparison-tabs button[aria-pressed='true'] {
  font-weight: 600;
  color: #2563eb;
  background: var(--asset-card);
  box-shadow: 0 1px 5px #1a39740d;
}

.comparison-filters label {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 12px;
}

.comparison-note {
  margin-top: 12px;
  line-height: 1.8;
}

.comparison-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}

.comparison-metric {
  padding: 18px;
  background: var(--asset-bg);
  border: 1px solid var(--asset-border);
  border-radius: 12px;
}

.comparison-metric h3 {
  font-size: 13px;
  font-weight: 500;
}

.comparison-metric strong {
  display: block;
  margin-top: 12px;
  font-size: clamp(18px, 2vw, 25px);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.comparison-rate {
  display: block;
  margin-top: 6px;
  font-size: 12px;
}

.comparison-metric dl {
  padding-top: 12px;
  margin-top: 14px;
  font-size: 12px;
  border-top: 1px solid var(--asset-border);
}

.comparison-metric dl div {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: space-between;
  margin-top: 6px;
}

.comparison-metric dt {
  color: var(--asset-muted);
}

.comparison-metric dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.up {
  color: #059669;
}

.down {
  color: #e05b63;
}

.comparison-details {
  margin-top: 18px;
}

.comparison-details summary {
  width: fit-content;
  font-size: 12px;
  color: #2563eb;
  cursor: pointer;
}

.comparison-footnote {
  margin-top: 14px;
  line-height: 1.8;
}

.comparison-empty {
  padding: 32px 12px;
  font-size: 13px;
  line-height: 1.8;
  color: var(--asset-muted);
  text-align: center;
}

@media (max-width: 760px) {
  .comparison-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
