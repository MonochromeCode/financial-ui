<script setup lang="ts">
import type {
  Account,
  AssetContext,
  Dashboard,
  UpdateRecord,
} from '#/api/finance/assets';

import { computed, onActivated, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import { message, Modal, Pagination } from 'ant-design-vue';

import {
  getAssetAccounts,
  getAssetContext,
  getAssetDashboard,
  getAssetHistory,
  initializeFamily,
} from '#/api/finance/assets';

import AssetChart from './asset-chart.vue';
import AssetCompositionChart from './asset-composition-chart.vue';
import {
  bucketOptions,
  cents,
  displayDate,
  formatMoney,
  today,
  usePrivacy,
} from './shared';

import './finance.css';

const router = useRouter();
const context = ref<AssetContext>();
const dashboard = ref<Dashboard>();
const loading = ref(true);
const failed = ref(false);
const memberId = ref<number>();
const excludeFixed = ref(false);
const hidden = usePrivacy();
const creating = ref(false);
const familyName = ref('我的家庭');
const range = ref('all');
const start = ref('');
const end = ref(today());
const net = ref(false);
const selected = ref<string[]>([]);
const detail = ref<UpdateRecord>();
const showCalendar = ref(false);
const calendarMonth = ref(today().slice(0, 7));
const showComposition = ref(false);
const compositionMode = ref<'amount' | 'ratio'>('amount');
const showAccounts = ref(false);
const accountLoading = ref(false);
const accountError = ref(false);
const accountTitle = ref('资产账户');
const accountRows = ref<Account[]>([]);
const showHistory = ref(false);
const historyLoading = ref(false);
const historyError = ref(false);
const historyPage = ref(1);
const historyRows = ref<UpdateRecord[]>([]);
const historyTotal = ref(0);
const historyCategory = ref('');
const historyStart = ref('');
const historyEnd = ref('');
let generation = 0;
let accountGeneration = 0;
let accountFilter: { category?: string; bucket?: string } = {};
let historyGeneration = 0;
let mounted = false;
const money = (value: null | string | undefined) =>
  formatMoney(value, hidden.value);
const recordDate = (record?: UpdateRecord) =>
  record?.sourceType === 'import'
    ? record.dataDate
    : displayDate(record?.createdAt);
const recordSource = (record: UpdateRecord) => {
  if (record.sourceType === 'import') return 'Excel 导入';
  if (record.operation === 'delete') return '手动删除';
  return '手动更新';
};
const categories = computed(() =>
  (context.value?.categories || []).filter(
    (item) => item.enabled && !(excludeFixed.value && item.code === 'fixed'),
  ),
);
const calendarRows = computed(
  () =>
    dashboard.value?.trends.filter((row) =>
      row.date.startsWith(calendarMonth.value),
    ) || [],
);
const monthlyTitle = computed(() => {
  const monthly = dashboard.value?.monthly;
  if (!monthly?.fallback || !monthly.latestDate) return '本月资产变化';
  const [year, month] = monthly.latestDate.split('-');
  return `${year}年${Number(month)}月资产变化`;
});
const monthlySnapshots = computed(() => {
  const data = dashboard.value;
  if (!data?.monthly.latestDate) return [];
  return data.trends
    .filter(
      (snapshot) =>
        snapshot.date === data.monthly.latestDate ||
        snapshot.date === data.monthly.baselineDate,
    )
    .toSorted((first, second) => second.date.localeCompare(first.date));
});
const filteredTrends = computed(() => {
  let since = start.value;
  if (range.value === 'year' || range.value === 'half') {
    const date = new Date();
    date.setMonth(date.getMonth() - (range.value === 'year' ? 12 : 6));
    since = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  return (dashboard.value?.trends || []).filter(
    (row) =>
      range.value === 'all' ||
      (row.date >= since &&
        (range.value !== 'custom' || row.date <= end.value)),
  );
});
const change = (value?: string) => {
  if (hidden.value) return '**** 元';
  const amount = cents(value);
  return amount === 0n
    ? `${money('0.00')}（持平）`
    : `${amount > 0n ? '↑' : '↓'} ${money((value || '0').replace('-', ''))}`;
};
const bucketHeight = (value: string) => {
  let max = 0n;
  for (const item of Object.values(dashboard.value?.buckets || {})) {
    const amount = cents(item);
    if (amount > max) max = amount;
  }
  return max === 0n ? 0 : Number((cents(value) * 100n) / max);
};
const memberName = (id: number) =>
  context.value?.members.find((item) => item.id === id)?.displayName ||
  '家庭成员';
const categoryName = (code: string) =>
  context.value?.categories.find((item) => item.code === code)?.name || code;
const categoryColor = (code: string) =>
  context.value?.categories.find((item) => item.code === code)?.color ||
  '#3b82f6';
const icon = (value: string) =>
  `lucide:${({ house: 'house', handshake: 'handshake', chart: 'chart-no-axes-combined', wallet: 'wallet', 'credit-card': 'credit-card' } as Record<string, string>)[value] || value}`;

async function load() {
  const current = ++generation;
  loading.value = true;
  failed.value = false;
  try {
    const result = await getAssetContext();
    if (current !== generation) return;
    context.value = result;
    if (!result.family) {
      dashboard.value = undefined;
      return;
    }
    if (
      memberId.value &&
      !result.members.some((item) => item.id === memberId.value)
    )
      memberId.value = undefined;
    const data = await getAssetDashboard({
      memberId: memberId.value,
      excludeFixed: excludeFixed.value,
    });
    if (current !== generation) return;
    dashboard.value = data;
    if (selected.value.length === 0)
      selected.value = result.categories
        .filter((item) => item.enabled)
        .map((item) => item.code);
  } catch {
    if (current === generation) failed.value = true;
  } finally {
    if (current === generation) loading.value = false;
  }
}
async function create() {
  if (!familyName.value.trim() || creating.value) return;
  creating.value = true;
  try {
    await initializeFamily(familyName.value.trim());
    await load();
    message.success('家庭账本已建立');
  } finally {
    creating.value = false;
  }
}
async function listAccounts(
  filter: { category?: string; bucket?: string } = {},
) {
  accountFilter = filter;
  accountTitle.value = filter.category
    ? categoryName(filter.category)
    : bucketOptions.find((item) => item.value === filter.bucket)?.label ||
      '资产账户';
  showAccounts.value = true;
  accountLoading.value = true;
  accountError.value = false;
  const current = ++accountGeneration;
  try {
    const rows = await getAssetAccounts({
      memberId: memberId.value,
      category: filter.category,
    });
    if (current === accountGeneration)
      accountRows.value = rows.filter(
        (item) =>
          !filter.bucket ||
          (item.fundBucket === filter.bucket &&
            item.categoryCode !== 'liability' &&
            !(excludeFixed.value && item.categoryCode === 'fixed')),
      );
  } catch {
    if (current === accountGeneration) accountError.value = true;
  } finally {
    if (current === accountGeneration) accountLoading.value = false;
  }
}
async function loadHistory() {
  showHistory.value = true;
  historyLoading.value = true;
  historyError.value = false;
  const current = ++historyGeneration;
  try {
    const result = await getAssetHistory({
      memberId: memberId.value,
      category: historyCategory.value || undefined,
      start: historyStart.value || undefined,
      end: historyEnd.value || undefined,
      page: historyPage.value,
      size: 12,
    });
    if (current === historyGeneration) {
      historyRows.value = result.list;
      historyTotal.value = result.total;
    }
  } catch {
    if (current === historyGeneration) historyError.value = true;
  } finally {
    if (current === historyGeneration) historyLoading.value = false;
  }
}
function edit() {
  void router.push('/finance/assets/edit');
}
watch([memberId, excludeFixed], () => {
  void load();
});
watch([historyCategory, historyStart, historyEnd], () => {
  historyPage.value = 1;
  if (showHistory.value) void loadHistory();
});
onMounted(() => {
  mounted = true;
  void load();
});
onActivated(() => {
  if (mounted && !loading.value) void load();
});
</script>

<template>
  <main class="finance-page finance-dashboard">
    <header v-if="context?.family" class="dashboard-toolbar">
      <nav
        v-if="!loading && !failed && dashboard"
        class="members"
        aria-label="成员筛选"
      >
        <button
          class="member-pill"
          :class="{ active: memberId === undefined }"
          @click="memberId = undefined"
        >
          {{
            context.owner || context.family.allowViewOthers
              ? '全部成员'
              : '我的资产'
          }}
        </button>
        <button
          v-for="member in context.members"
          :key="member.id"
          class="member-pill"
          :class="{ active: memberId === member.id }"
          @click="memberId = member.id"
        >
          {{ member.displayName }}
        </button>
      </nav>
      <button
        class="secondary-button"
        @click="router.push('/finance/assets/manage')"
      >
        <IconifyIcon icon="lucide:settings-2" class="mr-1 inline-block" /> 管理
      </button>
    </header>
    <div v-if="failed" class="error-card">
      资产数据加载失败，请检查网络后重试。<button
        class="text-button"
        @click="load"
      >
        重新加载
      </button>
    </div>
    <div v-if="loading" class="asset-grid">
      <div v-for="item in 4" :key="item" class="skeleton"></div>
    </div>
    <section v-else-if="!failed && !context?.family" class="asset-card intro">
      <IconifyIcon
        icon="lucide:house-plus"
        class="mx-auto mb-5 text-5xl text-blue-500"
      />
      <h2>建立你的家庭资产账本</h2>
      <p>
        按成员整理资产与负债，持续记录家庭的每一步变化。<br />如果已有家庭账本，请让所有者关联你的系统用户编号：{{
          context?.userId
        }}。
      </p>
      <div
        class="finance-form mx-auto mb-5"
        style="grid-template-columns: 1fr; max-width: 360px"
      >
        <label>家庭名称<input
            v-model="familyName"
            maxlength="80"
            placeholder="例如：我的家庭"
            @keyup.enter="create"
        /></label>
      </div>
      <button
        class="primary-button"
        :disabled="creating || !familyName.trim()"
        @click="create"
      >
        {{ creating ? '正在建立…' : '建立家庭账本' }}
      </button>
    </section>
    <template v-else-if="!failed && dashboard && context?.family">
      <div class="asset-grid">
        <section class="asset-card overview">
          <div class="row-between">
            <span>总资产
              <button
                class="privacy-button"
                :aria-label="hidden ? '显示金额' : '隐藏金额'"
                @click="hidden = !hidden"
              >
                <IconifyIcon
                  :icon="hidden ? 'lucide:eye-off' : 'lucide:eye'"
                /></button></span><label><input
                v-model="excludeFixed"
                type="checkbox"
              />排除固定资产</label>
          </div>
          <div class="overview-amount">
            {{ money(dashboard.overview.totalAssets) }}
          </div>
          <div class="overview-stats">
            <div>
              <span class="muted">净资产</span><strong>{{ money(dashboard.overview.netAssets) }}</strong>
            </div>
            <div>
              <span class="muted">总负债</span><strong>{{ money(dashboard.overview.totalLiabilities) }}</strong>
            </div>
            <div>
              <span class="muted">负债率</span><strong>{{
                dashboard.overview.debtRatio === null
                  ? '--'
                  : `${dashboard.overview.debtRatio}%`
              }}</strong>
            </div>
          </div>
          <p class="muted mt-5">
            最近更新 {{ displayDate(dashboard.overview.updatedAt) }}
          </p>
        </section>
        <section class="asset-card">
          <div class="section-heading">
            <h2>{{ monthlyTitle }}</h2>
            <button class="text-button" @click="showCalendar = true">
              资产月历 ↗
            </button>
          </div>
          <p class="muted">
            <template v-if="dashboard.monthly.latestDate">
              <template v-if="dashboard.monthly.fallback">
                本月暂无记录 · 展示最近有记录月份 ·
              </template>
              截至
              {{ dashboard.monthly.latestDate }} ·
            </template>
            {{
              !dashboard.monthly.latestDate
                ? '暂无资产记录'
                : dashboard.monthly.firstRecord
                  ? '首次记录 · 暂无历史基准'
                  : `对比 ${dashboard.monthly.baselineDate}`
            }}
          </p>
          <div
            v-if="dashboard.monthly.latestDate"
            class="month-number"
            :class="
              cents(dashboard.monthly.totalAssets) < 0n
                ? 'decrease'
                : 'increase'
            "
          >
            {{ change(dashboard.monthly.totalAssets) }}
          </div>
          <div v-if="dashboard.monthly.latestDate" class="month-columns">
            <div>
              <span class="muted">负债变化</span><strong>{{ change(dashboard.monthly.totalLiabilities) }}</strong>
            </div>
            <div>
              <span class="muted">净资产变化</span><strong>{{ change(dashboard.monthly.netAssets) }}</strong>
            </div>
          </div>
          <details v-if="monthlySnapshots.length" class="month-details">
            <summary>查看记录金额</summary>
            <div class="month-snapshots">
              <table aria-label="资产变化对比记录">
                <thead>
                  <tr>
                    <th scope="col">记录日期</th>
                    <th scope="col">总资产</th>
                    <th scope="col">总负债</th>
                    <th scope="col">净资产</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="snapshot in monthlySnapshots" :key="snapshot.date">
                    <th scope="row">
                      <time :datetime="snapshot.date">{{ snapshot.date }}</time>
                    </th>
                    <td>{{ money(snapshot.totalAssets) }}</td>
                    <td>{{ money(snapshot.totalLiabilities) }}</td>
                    <td>{{ money(snapshot.netAssets) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        </section>
        <section class="asset-card full-width">
          <div class="section-heading">
            <h2>资产组成<small>看清每一份资产的归属</small></h2>
            <button class="text-button" @click="showComposition = true">
              放大查看 ↗
            </button>
          </div>
          <AssetCompositionChart
            v-model:mode="compositionMode"
            v-model:hidden="hidden"
            :summary="dashboard.overview"
            :composition="dashboard.composition"
            :accounts="dashboard.accounts"
          />
          <div class="category-scroll">
            <button
              v-for="item in dashboard.composition"
              :key="item.code"
              class="category-tile"
              @click="listAccounts({ category: item.code })"
            >
              <span
                class="category-icon"
                :style="{ color: item.color, background: `${item.color}14` }"
                ><IconifyIcon :icon="icon(item.icon)" /></span>{{ item.name }}<strong>{{ money(item.amount) }}</strong><span class="muted">{{
                item.code === 'liability'
                  ? '单独统计 · 不计入占比'
                  : `${Number(item.ratio).toFixed(1)}% 占比`
              }}</span>
              <p class="muted mt-3">
                {{
                  dashboard.monthly.fallback
                    ? dashboard.monthly.latestDate?.slice(0, 7)
                    : '本月'
                }}
                {{ change(dashboard.monthly.categories[item.code]) }}
              </p>
            </button>
          </div>
        </section>
        <section class="asset-card">
          <div class="section-heading">
            <h2>四笔钱配置</h2>
            <span class="muted">按用途规划资产</span>
          </div>
          <div class="bucket-grid">
            <button
              v-for="bucket in bucketOptions"
              :key="bucket.value"
              class="bucket-item"
              @click="listAccounts({ bucket: bucket.value })"
            >
              <span>{{ bucket.label }}</span><small>{{ bucket.term }}</small>
              <div class="bucket-track">
                <span
                  class="bucket-fill"
                  :style="{
                    height: `${bucketHeight(dashboard.buckets[bucket.value] || '0')}%`,
                    background: bucket.color,
                  }"
                ></span>
              </div>
              <strong>{{ money(dashboard.buckets[bucket.value]) }}</strong>
            </button>
          </div>
          <div class="tags">
            <span
              v-for="type in dashboard.insuranceTypes"
              :key="type"
              class="tag"
              >{{ type }}</span><span class="muted">未分配 {{ money(dashboard.buckets.unassigned) }}</span>
          </div>
        </section>
        <section class="asset-card">
          <div class="section-heading">
            <h2>资产趋势</h2>
            <div class="filters">
              <select v-model="range" aria-label="趋势时间范围">
                <option value="all">记账以来</option>
                <option value="year">近一年</option>
                <option value="half">近半年</option>
                <option value="custom">自定义</option>
</select><select v-model="net" aria-label="趋势口径">
                <option :value="false">全部资产</option>
                <option :value="true">净资产</option>
              </select>
            </div>
          </div>
          <div v-if="range === 'custom'" class="filters mb-4">
            <input
              v-model="start"
              type="date"
              aria-label="开始日期"
              :max="end"
            /><span>至</span><input
              v-model="end"
              type="date"
              aria-label="结束日期"
              :min="start"
              :max="today()"
            />
          </div>
          <AssetChart
            v-if="filteredTrends.length >= 2"
            :snapshots="filteredTrends"
            :categories="categories"
            :selected="selected"
            :net="net"
            :hidden="hidden"
          />
          <div v-else class="empty-chart">
            <IconifyIcon
              icon="lucide:chart-no-axes-combined"
              class="empty-symbol"
            />
            <p>更新两天资产后<br />展示资产趋势</p>
            <span class="muted">当前范围有 {{ filteredTrends.length }} 天记录</span>
          </div>
          <div v-if="!net" class="legend">
            <label v-for="category in categories" :key="category.code"><input
                v-model="selected"
                type="checkbox"
                :value="category.code"
                :style="{ accentColor: category.color }"
              /><span :style="{ color: category.color }">{{
                category.name
              }}</span></label>
          </div>
        </section>
        <section class="asset-card full-width">
          <div class="section-heading">
            <h2>更新记录<small>每次变化都有迹可循</small></h2>
            <button
              class="text-button"
              @click="
                historyPage = 1;
                loadHistory();
              "
            >
              查看全部 ↗
            </button>
          </div>
          <div
            v-if="!dashboard.records.list.length"
            class="empty-chart"
            style="min-height: 130px"
          >
            <IconifyIcon icon="lucide:notebook-pen" class="empty-symbol" />
            <p>还没有更新记录，添加第一个资产账户吧。</p>
          </div>
          <template
            v-for="(record, index) in dashboard.records.list"
            :key="record.id"
          >
            <p
              v-if="
                index === 0 ||
                recordDate(dashboard.records.list[index - 1]).slice(0, 10) !==
                  recordDate(record).slice(0, 10)
              "
              class="record-group-date"
            >
              {{ recordDate(record).slice(0, 10) }}
            </p>
            <button class="record" @click="detail = record">
              <span
                class="category-icon"
                :style="{
                  color: categoryColor(record.categoryCode),
                  background: `${categoryColor(record.categoryCode)}14`,
                }"
                ><IconifyIcon icon="lucide:wallet" /></span>
              <div class="record-body">
                <strong>{{ record.accountName }}</strong>
                <p class="muted">
                  {{ memberName(record.memberId) }} ·
                  {{ categoryName(record.categoryCode) }} ·
                  {{ recordDate(record) }}
                </p>
              </div>
              <div class="record-amount">
                {{
                  record.operation === 'delete'
                    ? '已删除'
                    : money(record.currentBalance)
                }}<small><span class="status-dot"></span>{{ recordSource(record) }}</small>
              </div>
              <span class="muted">›</span>
            </button>
          </template>
        </section>
      </div>
      <footer class="bottom-actions">
        <button class="text-button" @click="hidden = !hidden">
          <IconifyIcon
            :icon="hidden ? 'lucide:eye-off' : 'lucide:shield-check'"
            class="mr-1 inline-block"
          />{{ hidden ? '隐私保护已开启' : '隐私保护' }}
</button><button class="primary-button" @click="edit">
          更新资产 <span class="ml-4">→</span>
        </button>
      </footer>
    </template>
    <Modal
      :open="!!detail"
      title="资产更新详情"
      :footer="null"
      @cancel="detail = undefined"
    >
      <dl v-if="detail" class="finance-detail my-5">
        <div>
          <dt>账户</dt>
          <dd>{{ detail.accountName }}</dd>
        </div>
        <div>
          <dt>成员 / 分类</dt>
          <dd>
            {{ memberName(detail.memberId) }} /
            {{ categoryName(detail.categoryCode) }}
          </dd>
        </div>
        <div>
          <dt>更新前</dt>
          <dd>{{ money(detail.previousBalance) }}</dd>
        </div>
        <div>
          <dt>更新后</dt>
          <dd>
            {{
              detail.operation === 'delete'
                ? '账户已删除'
                : money(detail.currentBalance)
            }}
          </dd>
        </div>
        <div>
          <dt>差额</dt>
          <dd>{{ change(detail.changeAmount) }}</dd>
        </div>
        <div>
          <dt>数据日期</dt>
          <dd>{{ detail.dataDate }}</dd>
        </div>
        <div>
          <dt>操作人</dt>
          <dd>{{ detail.operatorName || detail.operatorUserId }}</dd>
        </div>
        <div>
          <dt>来源 / 操作时间</dt>
          <dd>
            {{ recordSource(detail) }}<br />{{ displayDate(detail.createdAt) }}
          </dd>
        </div>
      </dl>
    </Modal>
    <Modal
      v-model:open="showCalendar"
      title="资产月历"
      :footer="null"
      :width="650"
    >
      <div class="finance-page" style="padding: 12px 0">
        <div class="filters mb-4">
          <input
            v-model="calendarMonth"
            type="month"
            aria-label="资产月历月份"
          />
        </div>
        <p class="muted mb-4">
          每个日期展示当天最后一次提交；金额遵循当前成员及固定资产筛选。
        </p>
        <div v-for="row in calendarRows" :key="row.date" class="snapshot-row">
          <span>{{ row.date }}</span><span>总资产 {{ money(row.totalAssets) }}<br /><small class="muted">净资产 {{ money(row.netAssets) }}</small></span>
        </div>
        <p v-if="!calendarRows.length" class="empty-chart">本月暂无资产快照</p>
      </div>
    </Modal>
    <Modal
      v-model:open="showComposition"
      title="家庭资产组成"
      :footer="null"
      :width="1500"
    >
      <div class="finance-page" style="padding: 12px 0">
        <AssetCompositionChart
          v-if="showComposition && dashboard"
          v-model:mode="compositionMode"
          v-model:hidden="hidden"
          :summary="dashboard.overview"
          :composition="dashboard.composition"
          :accounts="dashboard.accounts"
          expanded
        >
          <template #filter>
            <select
              v-model="memberId"
              class="composition-member-filter"
              aria-label="家庭资产组成成员"
            >
              <option :value="undefined">全部成员</option>
              <option
                v-for="member in context?.members"
                :key="member.id"
                :value="member.id"
              >
                {{ member.displayName }}
              </option>
            </select>
          </template>
        </AssetCompositionChart>
      </div>
    </Modal>
    <Modal
      v-model:open="showAccounts"
      :title="accountTitle"
      :footer="null"
      :width="650"
    >
      <div class="finance-page" style="padding: 12px 0">
        <div v-if="accountLoading" class="skeleton"></div>
        <div v-else-if="accountError" class="error-card">
          加载失败
          <button class="text-button" @click="listAccounts(accountFilter)">
            重试
          </button>
        </div>
        <template v-else>
          <div v-for="account in accountRows" :key="account.id" class="record">
            <div class="record-body">
              <strong>{{ account.name }}</strong>
              <p class="muted">
                {{ memberName(account.memberId) }} · {{ account.dataDate
                }}<br />{{ account.remark }}
              </p>
            </div>
            <span>{{ money(account.balance) }}</span>
          </div>
          <p v-if="!accountRows.length" class="empty-chart">还没有账户</p>
          <button class="primary-button mt-5" @click="edit">
            前往更新资产
          </button>
        </template>
      </div>
    </Modal>
    <Modal
      v-model:open="showHistory"
      title="全部更新记录"
      :footer="null"
      :width="780"
    >
      <div class="finance-page" style="padding: 12px 0">
        <div class="filters mb-4">
          <select v-model="historyCategory" aria-label="历史记录分类">
            <option value="">全部分类</option>
            <option
              v-for="category in context?.categories"
              :key="category.code"
              :value="category.code"
            >
              {{ category.name }}
            </option>
</select><input
            v-model="historyStart"
            type="date"
            aria-label="历史开始日期"
          /><input v-model="historyEnd" type="date" aria-label="历史结束日期" />
        </div>
        <div v-if="historyLoading" class="skeleton"></div>
        <div v-else-if="historyError" class="error-card">
          加载失败
          <button class="text-button" @click="loadHistory">重试</button>
        </div>
        <template v-else>
          <button
            v-for="record in historyRows"
            :key="record.id"
            class="record"
            @click="detail = record"
          >
            <div class="record-body">
              <strong>{{ record.accountName }}</strong>
              <p class="muted">
                {{ memberName(record.memberId) }} ·
                {{ recordDate(record) }}
              </p>
            </div>
            <span>{{
                record.operation === 'delete'
                  ? '已删除'
                  : money(record.currentBalance)
              }}
              ›</span>
          </button>
          <p v-if="!historyRows.length" class="empty-chart">
            暂无符合条件的更新记录
          </p>
          <Pagination
            v-if="historyTotal"
            v-model:current="historyPage"
            :total="historyTotal"
            :page-size="12"
            :show-size-changer="false"
            size="small"
            class="mt-5"
            @change="loadHistory"
          />
        </template>
      </div>
    </Modal>
  </main>
</template>
