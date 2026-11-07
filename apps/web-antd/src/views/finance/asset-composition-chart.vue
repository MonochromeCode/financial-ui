<script setup lang="ts">
import type { EchartsUIType } from '@vben/plugins/echarts';

import type { AssetFlowLink, AssetFlowNode } from './asset-composition';

import type { Account, Dashboard, Summary } from '#/api/finance/assets';

import { computed, nextTick, onMounted, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import { usePreferences } from '@vben/preferences';
import { dataURLtoBlob, downloadFileFromBlob } from '@vben/utils';

import {
  buildAssetFlow,
  flowRatio,
  formatFlowAmount,
} from './asset-composition';
import { cents, formatMoney } from './shared';

const props = withDefaults(
  defineProps<{
    summary: Summary;
    composition: Dashboard['composition'];
    accounts?: Account[];
    hidden: boolean;
    expanded?: boolean;
  }>(),
  { accounts: undefined, expanded: false },
);
const emit = defineEmits<{ 'update:hidden': [value: boolean] }>();
const mode = defineModel<'amount' | 'ratio'>('mode', { default: 'amount' });
const chartRef = ref<EchartsUIType>();
const { renderEcharts, getChartInstance } = useEcharts(chartRef);
const { isDark } = usePreferences();
const flow = computed(() =>
  buildAssetFlow(props.summary, props.composition, props.accounts),
);
const activeMode = computed(() => (props.hidden ? 'hidden' : mode.value));
const chartHeight = computed(
  () =>
    `${Math.max(props.expanded ? 470 : 400, flow.value.nodes.filter((node) => node.kind === 'account').length * 44 + 140)}px`,
);
const ratioBase = computed(() =>
  cents(props.summary.totalAssets) > 0n
    ? props.summary.totalAssets
    : props.summary.totalLiabilities,
);
const valueLabel = (amount: string, compact = true) => {
  if (props.hidden) return '****';
  if (mode.value === 'ratio') return flowRatio(amount, ratioBase.value);
  return compact ? formatFlowAmount(amount) : formatMoney(amount);
};
function selectMode(value: 'amount' | 'hidden' | 'ratio') {
  emit('update:hidden', value === 'hidden');
  if (value !== 'hidden') mode.value = value;
}
const largest = computed(() => {
  let result: Dashboard['composition'][number] | undefined;
  for (const item of props.composition) {
    if (item.code === 'liability' || cents(item.amount) <= 0n) continue;
    if (!result || cents(item.amount) > cents(result.amount)) result = item;
  }
  return result;
});
const hasShortfall = computed(() => cents(flow.value.shortfall) > 0n);
const description = computed(() =>
  hasShortfall.value
    ? '负债超过总资产，橙色分支表示资不抵债差额。'
    : '净资产与负债汇总为总资产，再按资产分类展开至具体账户。',
);
const money = (amount: string) => formatMoney(amount, props.hidden);

async function render() {
  await nextTick();
  if (flow.value.links.length === 0) return;
  const model = flow.value;
  await renderEcharts({
    animation: false,
    aria: {
      enabled: true,
      description: `资产组成桑基图。${description.value}`,
    },
    tooltip: {
      trigger: 'item',
      confine: true,
      renderMode: 'richText',
      formatter: (params) => {
        const item = Array.isArray(params) ? params[0] : params;
        if (!item) return '';
        const data = item.data as AssetFlowLink | AssetFlowNode;
        if ('source' in data) {
          const source = model.nodes.find((node) => node.name === data.source);
          const target = model.nodes.find((node) => node.name === data.target);
          return `${source?.title} → ${target?.title}\n${valueLabel(data.amount, false)}`;
        }
        return `${data.title}\n${valueLabel(data.amount, false)}`;
      },
    },
    series: [
      {
        type: 'sankey',
        left: 140,
        right: 190,
        top: 88,
        bottom: 28,
        nodeWidth: 9,
        nodeGap: 20,
        nodeAlign: 'left',
        layoutIterations: 0,
        draggable: false,
        data: model.nodes.map((node) => ({
          ...node,
          label:
            node.kind === 'total'
              ? {
                  ...node.label,
                  backgroundColor: isDark.value ? '#2b2d39' : '#f4f4f6',
                  borderRadius: 9,
                  padding: [9, 14],
                }
              : node.label,
        })),
        links: model.links.map((link) => ({
          ...link,
          lineStyle: {
            color: model.nodes.find(
              (node) =>
                node.name ===
                (link.source === 'net' || link.source === 'liability'
                  ? link.source
                  : link.target),
            )?.itemStyle.color,
          },
        })),
        lineStyle: { opacity: isDark.value ? 0.4 : 0.32, curveness: 0.5 },
        itemStyle: { borderWidth: 0 },
        label: {
          color: isDark.value ? '#dce4f2' : '#334155',
          distance: 14,
          fontSize: 13,
          lineHeight: 23,
          rich: {
            heading: { color: '#9792b8', fontSize: 14, lineHeight: 23 },
            value: { fontSize: 19, fontWeight: 600, lineHeight: 26 },
          },
          formatter: (params) => {
            const node = model.nodes.find((item) => item.name === params.name);
            if (!node) return '';
            return node.kind === 'total'
              ? `{heading|${node.title}}\n{value|${valueLabel(node.amount)}}`
              : `${node.title}  ${valueLabel(node.amount)}`;
          },
        },
        emphasis: { focus: 'adjacency', lineStyle: { opacity: 0.55 } },
      },
    ],
  });
}

async function downloadChart() {
  await render();
  const chart = getChartInstance();
  if (!chart) return;
  const image = chart.getDataURL({
    type: 'png',
    pixelRatio: 2,
    backgroundColor: isDark.value ? '#1c1e27' : '#ffffff',
  });
  downloadFileFromBlob({
    source: dataURLtoBlob(image),
    fileName: '家庭资产组成.png',
  });
}

onMounted(render);
watch(
  () => [
    props.summary,
    props.composition,
    props.accounts,
    props.hidden,
    props.expanded,
    mode.value,
    isDark.value,
  ],
  render,
  { deep: true },
);
</script>

<template>
  <div
    class="asset-composition-analysis"
    data-testid="asset-composition-analysis"
  >
    <div class="composition-toolbar">
      <slot name="filter"><span class="muted">家庭资产组成</span></slot>
      <div class="composition-display-controls">
        <div
          class="composition-display-modes"
          role="group"
          aria-label="图表显示方式"
        >
          <button
            v-for="option in [
              { value: 'amount', label: '金额' },
              { value: 'ratio', label: '比例' },
              { value: 'hidden', label: '隐藏金额' },
            ] as const"
            :key="option.value"
            :class="{ active: activeMode === option.value }"
            :aria-pressed="activeMode === option.value"
            @click="selectMode(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
        <button
          class="composition-download"
          aria-label="下载资产组成图"
          title="下载图片"
          :disabled="!flow.links.length"
          @click="downloadChart"
        >
          <IconifyIcon icon="lucide:download" />
        </button>
      </div>
    </div>
    <div
      v-if="flow.links.length"
      class="composition-flow-scroll"
      tabindex="0"
      aria-label="资产组成图，可横向滚动查看"
    >
      <EchartsUI
        ref="chartRef"
        class="asset-composition-chart"
        :height="chartHeight"
        data-testid="asset-composition-chart"
      />
    </div>
    <div v-else class="empty-chart">
      <span class="empty-symbol">↗</span>
      <span>记录资产或负债后，在这里查看资产组成</span>
    </div>
    <p class="muted composition-flow-note">
      {{ description }} 比例以{{
        cents(summary.totalAssets) > 0n ? '总资产' : '总负债'
      }}为基数，金额较大时以万、亿显示。
    </p>
    <div v-if="flow.links.length && !expanded" class="composition-insights">
      <div>
        <span class="muted">{{
          hasShortfall ? '资不抵债差额' : '净资产'
        }}</span>
        <strong :class="{ decrease: hasShortfall }">{{
          money(hasShortfall ? flow.shortfall : summary.netAssets)
        }}</strong>
      </div>
      <div>
        <span class="muted">负债率</span>
        <strong>{{
          hidden
            ? '****'
            : summary.debtRatio === null
              ? '--'
              : `${summary.debtRatio}%`
        }}</strong>
      </div>
      <div>
        <span class="muted">主要资产 · {{ largest?.name || '暂无资产' }}</span>
        <strong>{{
          hidden ? '****' : largest ? `${largest.ratio}%` : '--'
        }}</strong>
      </div>
    </div>
  </div>
</template>
