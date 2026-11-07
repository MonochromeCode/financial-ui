<script setup lang="ts">
import type { GridErrors, GridForm, GridRow, GridStrategy } from './grid';

import { computed, onMounted, ref } from 'vue';

import { message, Modal } from 'ant-design-vue';

import { getAssetContext } from '#/api/finance/assets';

import { calculateGrid, readStrategies, validateGrid } from './grid';

import './style.css';

const strategies = ref<GridStrategy[]>([]);
const selectedId = ref('');
const loading = ref(true);
const loadFailed = ref(false);
const editorOpen = ref(false);
const saving = ref(false);
const editingId = ref('');
const errors = ref<GridErrors>({});
const form = ref<GridForm>(emptyForm());
let storageKey = '';

const selected = computed(() =>
  strategies.value.find((strategy) => strategy.id === selectedId.value),
);
const result = computed(() =>
  selected.value ? calculateGrid(selected.value) : undefined,
);

function emptyForm(): GridForm {
  return {
    name: '',
    triggerPrice: '',
    gridAmount: '',
    buyStrategy: 'equal',
    increasePercent: '10',
    gridPercent: '5',
    stressPercent: '30',
    mediumLargeEnabled: false,
    mediumPercent: '15',
    largePercent: '30',
  };
}

function money(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function price(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 6,
  }).format(value);
}

function level(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function gridName(type: GridRow['type']): string {
  return { small: '小网', medium: '中网', large: '大网' }[type];
}

async function load() {
  loading.value = true;
  loadFailed.value = false;
  try {
    const context = await getAssetContext();
    storageKey = `finance-grid:v1:${context.tenantId}:${context.userId}`;
    strategies.value = readStrategies(localStorage, storageKey);
    selectedId.value = strategies.value[0]?.id || '';
  } catch {
    loadFailed.value = true;
  } finally {
    loading.value = false;
  }
}

function create(sample = false) {
  editingId.value = '';
  errors.value = {};
  form.value = sample
    ? {
        name: '云铝',
        triggerPrice: '26.1',
        gridAmount: '2610',
        buyStrategy: 'equal',
        increasePercent: '10',
        gridPercent: '5',
        stressPercent: '30',
        mediumLargeEnabled: false,
        mediumPercent: '15',
        largePercent: '30',
      }
    : emptyForm();
  editorOpen.value = true;
}

function edit(strategy: GridStrategy) {
  editingId.value = strategy.id;
  errors.value = {};
  form.value = {
    name: strategy.name,
    triggerPrice: strategy.triggerPrice,
    gridAmount: strategy.gridAmount,
    buyStrategy: strategy.buyStrategy,
    increasePercent: strategy.increasePercent,
    gridPercent: strategy.gridPercent,
    stressPercent: strategy.stressPercent,
    mediumLargeEnabled: strategy.mediumLargeEnabled,
    mediumPercent: strategy.mediumPercent,
    largePercent: strategy.largePercent,
  };
  editorOpen.value = true;
}

function persist(next: GridStrategy[]): boolean {
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
    strategies.value = next;
    return true;
  } catch {
    message.error('本机保存失败，请检查浏览器存储空间或权限');
    return false;
  }
}

function save() {
  if (saving.value) return;
  errors.value = validateGrid(form.value);
  if (Object.keys(errors.value).length > 0) return;
  saving.value = true;
  try {
    const strategy: GridStrategy = {
      ...form.value,
      name: form.value.name.trim(),
      id: editingId.value || crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
    };
    const next = editingId.value
      ? strategies.value.map((item) =>
          item.id === editingId.value ? strategy : item,
        )
      : [strategy, ...strategies.value];
    if (!persist(next)) return;
    selectedId.value = strategy.id;
    editorOpen.value = false;
    message.success('策略已保存到当前浏览器');
  } finally {
    saving.value = false;
  }
}

function remove(strategy: GridStrategy) {
  Modal.confirm({
    title: `删除策略“${strategy.name}”？`,
    content: '删除后无法恢复。',
    okText: '删除',
    cancelText: '取消',
    okType: 'danger',
    onOk() {
      const next = strategies.value.filter((item) => item.id !== strategy.id);
      if (persist(next) && selectedId.value === strategy.id) {
        selectedId.value = next[0]?.id || '';
      }
    },
  });
}

onMounted(load);
</script>

<template>
  <div class="grid-page">
    <header class="grid-hero">
      <div>
        <p class="grid-eyebrow">资产管理 / 策略测算</p>
        <h1>网格策略</h1>
        <p>设置价格与资金，预览逐档买卖计划和下跌压力测算。</p>
      </div>
      <button class="grid-primary grid-add" type="button" @click="create()">
        + 新建策略
      </button>
    </header>

    <div v-if="loading" class="grid-state">正在读取策略…</div>
    <div v-else-if="loadFailed" class="grid-state">
      <p>无法读取当前用户信息，请稍后重试。</p>
      <button class="grid-secondary" type="button" @click="load">重试</button>
    </div>
    <template v-else>
      <div class="grid-notice">
        当前为试用版：策略仅保存在此浏览器，按登录用户隔离。小、中、大网分别计算并累加买入；每档股数按预算向下取整至
        100 股，不含手续费和滑点。
      </div>

      <section
        v-if="strategies.length"
        class="grid-strategies"
        aria-label="我的策略"
      >
        <div class="grid-section-title">
          <div>
            <p class="grid-eyebrow">MY STRATEGIES</p>
            <h2>我的策略</h2>
          </div>
          <span>{{ strategies.length }} 条策略</span>
        </div>
        <div class="grid-card-list">
          <button
            v-for="strategy in strategies"
            :key="strategy.id"
            class="grid-strategy-card"
            :class="{ 'grid-strategy-active': selectedId === strategy.id }"
            type="button"
            :aria-pressed="selectedId === strategy.id"
            @click="selectedId = strategy.id"
          >
            <span class="grid-card-name">{{ strategy.name }}</span>
            <span class="grid-card-values">
              <span><small>触发价格</small><strong>{{ strategy.triggerPrice }} 元</strong></span>
              <span><small>网格大小</small><strong>{{ strategy.gridPercent }}%</strong></span>
            </span>
            <span class="grid-card-meta">
              {{
                strategy.buyStrategy === 'progressive'
                  ? `逐格加码 ${strategy.increasePercent}%`
                  : '等额买入'
              }}
              <span v-if="strategy.mediumLargeEnabled"> · 小/中/大网</span>
            </span>
            <span class="grid-card-open">查看网格 →</span>
          </button>
        </div>
      </section>

      <div v-else class="grid-empty">
        <div class="grid-empty-icon">▤</div>
        <h2>还没有网格策略</h2>
        <p>可以从空白策略开始，也可以载入截图中的“云铝”参数验证测算。</p>
        <div class="grid-actions">
          <button class="grid-primary" type="button" @click="create()">
            新建策略
          </button>
          <button class="grid-secondary" type="button" @click="create(true)">
            载入截图示例
          </button>
        </div>
      </div>

      <section v-if="selected && result" class="grid-detail">
        <div class="grid-section-title">
          <div>
            <p class="grid-eyebrow">STRATEGY DETAIL</p>
            <h2>{{ selected.name }} · 网格详情</h2>
          </div>
          <div class="grid-actions">
            <button
              class="grid-secondary"
              type="button"
              @click="edit(selected)"
            >
              编辑策略
            </button>
            <button
              class="grid-text-danger"
              type="button"
              @click="remove(selected)"
            >
              删除
            </button>
          </div>
        </div>

        <div class="grid-metrics">
          <div>
            <small>最大投入</small><strong>{{ money(result.totalInvestment) }} <em>元</em></strong>
          </div>
          <div>
            <small>最大浮亏</small><strong>{{ money(result.floatingLoss) }} <em>元</em></strong>
          </div>
          <div>
            <small>最大买入网数</small><strong>{{ result.boughtGrids }} <em>档</em></strong>
          </div>
          <div>
            <small>最大买入股数</small><strong>{{ result.totalShares }} <em>股</em></strong>
          </div>
        </div>

        <div class="grid-legend" aria-label="网格类型">
          <span><i class="grid-type-small"></i>小网
            {{ selected.gridPercent }}%</span>
          <template v-if="selected.mediumLargeEnabled">
            <span><i class="grid-type-medium"></i>中网
              {{ selected.mediumPercent }}%</span>
            <span><i class="grid-type-large"></i>大网
              {{ selected.largePercent }}%</span>
          </template>
        </div>

        <div class="grid-table-wrap">
          <table class="grid-table">
            <thead>
              <tr>
                <th scope="col">类型</th>
                <th scope="col">档位</th>
                <th scope="col">买入价</th>
                <th scope="col">卖出价</th>
                <th scope="col">计划金额</th>
                <th scope="col">交易股数</th>
                <th scope="col">盈利额</th>
                <th scope="col">盈利比</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in result.rows" :key="index">
                <td>
                  <span
                    class="grid-type-label"
                    :class="`grid-type-${row.type}`"
                  >
                    {{ gridName(row.type) }}
                  </span>
                </td>
                <td>{{ level(row.level) }}</td>
                <td>{{ price(row.buyPrice) }}</td>
                <td>{{ price(row.sellPrice) }}</td>
                <td>{{ money(row.budget) }}</td>
                <td>{{ row.shares }}</td>
                <td>{{ money(row.profit) }}</td>
                <td>{{ row.profitPercent.toFixed(2) }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="grid-caption">
          压力终点价
          {{ price(result.endPrice) }}
          元；假设价格单向下跌，触及各档后买入且期间没有卖出。盈利为单档理论毛收益。
        </p>
      </section>
    </template>

    <div
      v-if="editorOpen"
      class="grid-dialog-backdrop"
      @click.self="editorOpen = false"
    >
      <section
        class="grid-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="grid-editor-title"
      >
        <div class="grid-dialog-heading">
          <div>
            <p class="grid-eyebrow">GRID SETTINGS</p>
            <h2 id="grid-editor-title">
              {{ editingId ? '编辑策略' : '新建策略' }}
            </h2>
          </div>
          <button
            class="grid-close"
            type="button"
            aria-label="关闭"
            @click="editorOpen = false"
          >
            ×
          </button>
        </div>
        <form class="grid-form" novalidate @submit.prevent="save">
          <label>
            <span>策略名称</span>
            <input
              v-model="form.name"
              maxlength="40"
              placeholder="例如：云铝"
              autocomplete="off"
            />
            <small v-if="errors.name" class="grid-error">{{
              errors.name
            }}</small>
          </label>
          <label>
            <span>触发价格 <em>元</em></span>
            <input
              v-model="form.triggerPrice"
              inputmode="decimal"
              placeholder="例如：26.1"
              autocomplete="off"
            />
            <small v-if="errors.triggerPrice" class="grid-error">{{
              errors.triggerPrice
            }}</small>
          </label>
          <label>
            <span>网格金额 <em>元 / 档</em></span>
            <input
              v-model="form.gridAmount"
              inputmode="decimal"
              placeholder="例如：2610"
              autocomplete="off"
            />
            <small v-if="errors.gridAmount" class="grid-error">{{
              errors.gridAmount
            }}</small>
          </label>
          <label>
            <span>买入策略</span>
            <select v-model="form.buyStrategy">
              <option value="equal">等额买入</option>
              <option value="progressive">逐格加码</option>
            </select>
            <small v-if="errors.buyStrategy" class="grid-error">{{
              errors.buyStrategy
            }}</small>
          </label>
          <label v-if="form.buyStrategy === 'progressive'">
            <span>每格加码 <em>%</em></span>
            <input
              v-model="form.increasePercent"
              inputmode="decimal"
              placeholder="例如：10"
              autocomplete="off"
            />
            <small class="grid-hint">各类型网格分别从首档算起；第 i 档预算 = 基础金额 × (1 + i ×
              加码比例)，首档 i = 0。</small>
            <small v-if="errors.increasePercent" class="grid-error">{{
              errors.increasePercent
            }}</small>
          </label>
          <label>
            <span>网格大小 <em>%</em></span>
            <input
              v-model="form.gridPercent"
              inputmode="decimal"
              placeholder="例如：5"
              autocomplete="off"
            />
            <small v-if="errors.gridPercent" class="grid-error">{{
              errors.gridPercent
            }}</small>
          </label>
          <label>
            <span>压力测试 <em>%</em></span>
            <input
              v-model="form.stressPercent"
              inputmode="decimal"
              placeholder="例如：30"
              autocomplete="off"
            />
            <small v-if="errors.stressPercent" class="grid-error">{{
              errors.stressPercent
            }}</small>
          </label>
          <label class="grid-toggle">
            <span>启用中网大网</span>
            <input v-model="form.mediumLargeEnabled" type="checkbox" />
          </label>
          <template v-if="form.mediumLargeEnabled">
            <label>
              <span>中网大小 <em>%</em></span>
              <input
                v-model="form.mediumPercent"
                inputmode="decimal"
                autocomplete="off"
              />
              <small v-if="errors.mediumPercent" class="grid-error">{{
                errors.mediumPercent
              }}</small>
            </label>
            <label>
              <span>大网大小 <em>%</em></span>
              <input
                v-model="form.largePercent"
                inputmode="decimal"
                autocomplete="off"
              />
              <small v-if="errors.largePercent" class="grid-error">{{
                errors.largePercent
              }}</small>
            </label>
          </template>
          <div class="grid-dialog-actions">
            <button
              class="grid-secondary"
              type="button"
              @click="editorOpen = false"
            >
              取消
            </button>
            <button class="grid-primary" type="submit" :disabled="saving">
              保存策略
            </button>
          </div>
        </form>
      </section>
    </div>
  </div>
</template>
