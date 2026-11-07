<script setup lang="ts">
import type { EchartsUIType } from '@vben/plugins/echarts';
import type { Category, Snapshot } from '#/api/finance/assets';
import { nextTick, onMounted, ref, watch } from 'vue';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import { formatMoney } from './shared';

const props = defineProps<{
  snapshots: Snapshot[];
  categories: Category[];
  selected: string[];
  net: boolean;
  hidden: boolean;
}>();
const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);
async function render() {
  await nextTick();
  const series = props.net
    ? [
        {
          name: '净资产',
          color: '#3b82f6',
          values: props.snapshots.map((row) => row.netAssets),
        },
      ]
    : props.categories
        .filter((category) => props.selected.includes(category.code))
        .map((category) => ({
          name: category.name,
          color: category.color,
          values: props.snapshots.map(
            (row) => row.amounts[category.code] || '0.00',
          ),
        }));
  renderEcharts({
    animation: false,
    grid: { left: 10, right: 20, top: 18, bottom: 12, containLabel: true },
    xAxis: {
      type: 'category',
      data: props.snapshots.map((row) => row.date),
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) =>
          props.hidden ? '****' : value.toLocaleString('zh-CN'),
      },
      splitLine: { lineStyle: { color: '#e9edf4', type: 'dashed' } },
    },
    tooltip: {
      trigger: 'axis',
      renderMode: 'richText',
      formatter: (params) => {
        const items = Array.isArray(params) ? params : [params];
        return [
          props.snapshots[items[0]?.dataIndex ?? 0]?.date || '',
          ...items.map(
            (item) =>
              `${item.seriesName}: ${formatMoney(series[item.seriesIndex ?? 0]?.values[item.dataIndex], props.hidden)}`,
          ),
        ].join('\n');
      },
    },
    series: series.map((item) => ({
      name: item.name,
      type: 'line',
      smooth: false,
      symbolSize: 7,
      itemStyle: { color: item.color },
      lineStyle: { width: 3 },
      data: item.values.map(Number),
    })),
  });
}
onMounted(render);
watch(
  () => [
    props.snapshots,
    props.selected,
    props.net,
    props.hidden,
    props.categories,
  ],
  render,
  { deep: true },
);
</script>
<template>
  <EchartsUI ref="chartRef" class="asset-trend-chart" style="height: 280px" />
</template>
