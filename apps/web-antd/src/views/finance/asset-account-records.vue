<script setup lang="ts">
import type { AccountSnapshots, Category, Member } from '#/api/finance/assets';

import { formatMoney } from './shared';

const props = defineProps<{
  records: AccountSnapshots;
  members: Member[];
  categories: Category[];
  hidden: boolean;
}>();
const money = (value: null | string | undefined) =>
  formatMoney(value, props.hidden);
const columnScope = (column: AccountSnapshots['columns'][number]) =>
  [
    props.members.find((member) => member.id === column.memberId)?.displayName,
    props.categories.find((category) => category.code === column.categoryCode)
      ?.name,
  ]
    .filter(Boolean)
    .join(' · ');
</script>

<template>
  <p class="muted account-records-note">
    每行是该记账日期最后一次提交后的账户余额，未修改账户沿用上次余额；“—”表示当时尚未建立、已删除或不在筛选范围内。金额单位：元。
  </p>
  <div
    v-if="records.rows.length"
    class="account-records-scroll"
    tabindex="0"
    role="region"
    aria-label="历史账户金额明细，可横向滚动查看全部账户"
  >
    <table class="account-records-table" aria-label="历史账户金额明细">
      <thead>
        <tr>
          <th scope="col">记录日期</th>
          <th v-for="column in records.columns" :key="column.id" scope="col">
            {{ column.name }}
            <small>{{ columnScope(column) }}</small>
          </th>
          <th scope="col">总资产</th>
          <th scope="col">总负债</th>
          <th scope="col">净资产</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in records.rows" :key="row.date">
          <th scope="row">
            <time :datetime="row.date">{{ row.date }}</time>
          </th>
          <td v-for="column in records.columns" :key="column.id">
            {{
              row.amounts[column.id] === undefined
                ? '—'
                : money(row.amounts[column.id])
            }}
          </td>
          <td>{{ money(row.totalAssets) }}</td>
          <td>{{ money(row.totalLiabilities) }}</td>
          <td>{{ money(row.netAssets) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
  <p v-else class="empty-chart">当前筛选范围暂无历史记录</p>
</template>
