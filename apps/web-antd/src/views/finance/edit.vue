<script setup lang="ts">
import type { Account, AssetContext } from '#/api/finance/assets';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { onBeforeRouteLeave, useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import { message, Modal } from 'ant-design-vue';

import {
  getAssetAccounts,
  getAssetContext,
  submitAssets,
} from '#/api/finance/assets';

import { cents, decimal, formatMoney, today, usePrivacy } from './shared';
import { useAssetDictionaries } from './use-asset-dictionaries';

import './finance.css';

interface DraftAccount extends Account {
  key: string;
}
const router = useRouter();
const context = ref<AssetContext>();
const {
  bucketOptions,
  templates,
  insuranceTypes,
  label: dictionaryLabel,
} = useAssetDictionaries(context);
const rows = ref<DraftAccount[]>([]);
const selected = ref('liquid');
const updateDate = ref(today());
const loading = ref(true);
const failed = ref(false);
const saving = ref(false);
const hidden = usePrivacy();
const restored = ref(false);
const storageError = ref(false);
const online = ref(navigator.onLine);
const savedAt = ref('');
const requestId = ref<string>(crypto.randomUUID());
const modalOpen = ref(false);
const modalIndex = ref(-1);
const formError = ref('');
const form = ref<DraftAccount>();
const chosenTemplate = ref('');
const baseline = new Map<number, string>();
let ready = false;
let allowedLeave = false;
let draftKey = '';
const categories = computed(
  () => context.value?.categories.filter((item) => item.enabled) || [],
);
const currentCategory = computed(() =>
  categories.value.find((item) => item.code === selected.value),
);
const editableMembers = computed(
  () =>
    context.value?.members.filter(
      (member) =>
        context.value?.owner || member.id === context.value?.currentMemberId,
    ) || [],
);
const fields = (row: Account): Account => ({
  id: row.id,
  version: row.version,
  memberId: row.memberId,
  categoryCode: row.categoryCode,
  name: row.name,
  templateCode: row.templateCode || null,
  balance:
    row.balance === '' || row.balance === null ? null : String(row.balance),
  fundBucket: row.categoryCode === 'liability' ? null : row.fundBucket || null,
  insuranceType:
    row.fundBucket === 'insurance' ? row.insuranceType || null : null,
  dataDate: row.dataDate,
  sortOrder: row.sortOrder,
  remark: row.remark || '',
  deleted: !!row.deleted,
});
const canEdit = (row: Account) =>
  !!context.value &&
  (context.value.owner || row.memberId === context.value.currentMemberId);
const changes = computed(() =>
  rows.value.filter(
    (row) =>
      canEdit(row) &&
      (!row.id || JSON.stringify(fields(row)) !== baseline.get(row.id)),
  ),
);
const dirty = computed(() => changes.value.length > 0);
const index = computed(() =>
  Math.max(
    0,
    categories.value.findIndex((item) => item.code === selected.value),
  ),
);
const finalStep = computed(() => index.value === categories.value.length - 1);
const money = (value: null | string) => formatMoney(value, hidden.value);
function total(code: string, member?: number) {
  return decimal(
    rows.value
      .filter(
        (row) =>
          !row.deleted &&
          row.categoryCode === code &&
          (!member || row.memberId === member),
      )
      .reduce((sum, row) => sum + cents(row.balance), 0n),
  );
}
function categoryStatus(code: string) {
  const items = rows.value.filter(
    (row) => !row.deleted && row.categoryCode === code,
  );
  if (items.some((row) => error(row))) return '存在校验错误';
  return items.some((row) => row.balance !== null && row.balance !== '')
    ? money(total(code))
    : '待填写';
}
function error(row: Account): string {
  if (row.deleted) return '';
  if (!row.name.trim()) return '请输入账户名称';
  if (
    row.balance !== null &&
    row.balance !== '' &&
    !/^\d+(\.\d{1,2})?$/.test(String(row.balance))
  )
    return '请输入非负金额，最多两位小数';
  if (context.value && cents(row.balance) > cents(context.value.maxBalance))
    return `金额不能超过 ${formatMoney(context.value.maxBalance, hidden.value)}`;
  if (!row.dataDate || row.dataDate > today())
    return '请选择有效的数据日期，不能晚于今天';
  if (!categories.value.some((item) => item.code === row.categoryCode))
    return '分类已停用，请选择其他分类';
  return '';
}
function persist() {
  if (!ready || !draftKey) return;
  try {
    if (!dirty.value) {
      localStorage.removeItem(draftKey);
      savedAt.value = '';
      return;
    }
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        accounts: changes.value.map((row) => ({
          ...fields(row),
          key: row.key,
        })),
        updateDate: updateDate.value,
        requestId: requestId.value,
      }),
    );
    savedAt.value = new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
    storageError.value = false;
  } catch {
    storageError.value = true;
  }
}
async function load() {
  ready = false;
  loading.value = true;
  failed.value = false;
  try {
    const result = await getAssetContext();
    context.value = result;
    if (!result.family) {
      allowedLeave = true;
      await router.replace('/dashboard/workspace');
      return;
    }
    const accounts = await getAssetAccounts();
    baseline.clear();
    accounts.forEach((row) => {
      if (row.id) baseline.set(row.id, JSON.stringify(fields(row)));
    });
    rows.value = accounts.map((row) => ({
      ...fields(row),
      sourceType: row.sourceType,
      key: `saved-${row.id}`,
    }));
    draftKey = `financial-assets-draft:${result.tenantId}:${result.userId}:${result.family.id}`;
    restored.value = false;
    try {
      const stored = localStorage.getItem(draftKey);
      if (stored) {
        const draft = JSON.parse(stored) as {
          accounts: DraftAccount[];
          updateDate: string;
          requestId: string;
        };
        if (Array.isArray(draft.accounts)) {
          for (const item of draft.accounts) {
            if (!canEdit(item)) continue;
            const position = rows.value.findIndex(
              (row) => item.id && row.id === item.id,
            );
            const restoredRow = {
              ...fields(item),
              sourceType:
                position === -1 ? undefined : rows.value[position]?.sourceType,
              key: item.key || crypto.randomUUID(),
            };
            if (position === -1) rows.value.push(restoredRow);
            else rows.value[position] = restoredRow;
          }
          updateDate.value = draft.updateDate || today();
          requestId.value = draft.requestId || crypto.randomUUID();
          restored.value = true;
        }
      }
    } catch {
      storageError.value = true;
    }
    if (!categories.value.some((item) => item.code === selected.value))
      selected.value = categories.value[0]?.code || 'liquid';
    await nextTick();
    ready = true;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}
watch(
  [rows, updateDate],
  () => {
    if (ready) {
      requestId.value = crypto.randomUUID();
      persist();
    }
  },
  { deep: true },
);
function add(memberId: number) {
  modalIndex.value = -1;
  chosenTemplate.value = '';
  form.value = {
    key: crypto.randomUUID(),
    memberId,
    categoryCode: selected.value,
    name: '',
    balance: null,
    templateCode: null,
    fundBucket: null,
    insuranceType: null,
    dataDate: today(),
    sortOrder: rows.value.length,
    remark: '',
  };
  formError.value = '';
  modalOpen.value = true;
}
function edit(row: DraftAccount) {
  if (!canEdit(row)) return;
  modalIndex.value = rows.value.findIndex((item) => item.key === row.key);
  chosenTemplate.value = row.templateCode || '';
  form.value = { ...row };
  formError.value = '';
  modalOpen.value = true;
}
function saveForm() {
  if (!form.value) return;
  formError.value = error(form.value);
  if (formError.value) return;
  if (
    form.value.templateCode &&
    rows.value.some(
      (row) =>
        row.key !== form.value?.key &&
        !row.deleted &&
        row.memberId === form.value?.memberId &&
        row.templateCode === form.value?.templateCode,
    )
  ) {
    formError.value = '该成员已存在相同的模板账户，请选择自定义账户';
    return;
  }
  const result = { ...fields(form.value), key: form.value.key };
  if (modalIndex.value < 0) rows.value.push(result);
  else rows.value[modalIndex.value] = result;
  modalOpen.value = false;
}
watch(chosenTemplate, (value) => {
  if (modalIndex.value < 0 && form.value) {
    form.value.templateCode = value || null;
    const template = templates.value.find((item) => item.value === value);
    if (template) form.value.name = template.label;
  }
});
function remove(row: DraftAccount) {
  Modal.confirm({
    title: `删除“${row.name}”？`,
    content: '账户将在完成更新后删除，历史记录仍会保留。',
    okText: '删除账户',
    cancelText: '取消',
    okType: 'danger',
    onOk() {
      if (row.id) row.deleted = true;
      else rows.value = rows.value.filter((item) => item.key !== row.key);
    },
  });
}
function move(row: DraftAccount, direction: number) {
  const siblings = rows.value
    .filter(
      (item) =>
        !item.deleted &&
        item.categoryCode === row.categoryCode &&
        item.memberId === row.memberId,
    )
    .toSorted((first, second) => first.sortOrder - second.sortOrder);
  const position = siblings.findIndex((item) => item.key === row.key);
  const target = position + direction;
  if (target < 0 || target >= siblings.length) return;
  const moved = siblings.splice(position, 1)[0];
  if (moved) siblings.splice(target, 0, moved);
  siblings.forEach((item, order) => {
    item.sortOrder = order;
  });
}
function next() {
  const bad = rows.value.find(
    (row) => canEdit(row) && row.categoryCode === selected.value && error(row),
  );
  if (bad) {
    message.error(error(bad));
    return;
  }
  persist();
  const category = categories.value[index.value + 1];
  if (category) selected.value = category.code;
}
async function submit() {
  if (saving.value || !dirty.value) return;
  const bad = changes.value.find((row) => error(row));
  if (bad) {
    selected.value = bad.categoryCode;
    message.error(error(bad));
    return;
  }
  if (!updateDate.value || updateDate.value > today()) {
    message.error('请选择有效的记账日期');
    return;
  }
  saving.value = true;
  persist();
  try {
    await submitAssets({
      requestId: requestId.value,
      updateDate: updateDate.value,
      accounts: changes.value.map(fields),
    });
    ready = false;
    try {
      localStorage.removeItem(draftKey);
    } catch {}
    allowedLeave = true;
    message.success('资产更新成功');
    await router.push('/dashboard/workspace');
  } catch {
    message.error('提交未成功，输入和草稿已保留，请检查网络或错误提示后重试。');
  } finally {
    saving.value = false;
  }
}
function discard() {
  Modal.confirm({
    title: '放弃当前全部修改？',
    content: '将清除本地草稿并重新读取已保存账户。',
    okText: '放弃修改',
    cancelText: '继续编辑',
    onOk() {
      ready = false;
      try {
        localStorage.removeItem(draftKey);
      } catch {}
      void load();
    },
  });
}
onBeforeRouteLeave(async () => {
  if (allowedLeave) return true;
  if (saving.value) return false;
  if (!dirty.value || allowedLeave) return true;
  persist();
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: '当前修改尚未保存，确定退出吗？',
      content: '退出后将清除本次草稿；继续编辑可以保留全部输入。',
      okText: '放弃修改',
      cancelText: '继续编辑',
      onOk: () => {
        ready = false;
        try {
          localStorage.removeItem(draftKey);
        } catch {}
        resolve(true);
      },
      onCancel: () => resolve(false),
    });
  });
});
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value) {
    persist();
    event.preventDefault();
    event.returnValue = '';
  }
}
function updateOnline() {
  online.value = navigator.onLine;
}
onMounted(() => {
  void load();
  window.addEventListener('beforeunload', beforeUnload);
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
});
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload);
  window.removeEventListener('online', updateOnline);
  window.removeEventListener('offline', updateOnline);
});
</script>

<template>
  <main class="finance-page">
    <header class="page-heading">
      <div>
        <div class="eyebrow">理财有数 · UPDATE ASSETS</div>
        <h1>更新家庭资产</h1>
        <p class="muted">按分类填写最新余额，完成后统一保存。</p>
      </div>
      <button
        class="secondary-button"
        :disabled="saving"
        @click="router.push('/dashboard/workspace')"
      >
        返回首页
      </button>
    </header>
    <div v-if="loading" class="skeleton"></div>
    <div v-else-if="failed" class="error-card">
      编辑数据加载失败，本地草稿已保留。<button
        class="text-button"
        @click="load"
      >
        重试
      </button>
    </div>
    <template v-else-if="context?.family">
      <div v-if="!online" class="draft-banner">
        网络已断开，输入会继续保存到本机；恢复网络后可重新提交。
      </div>
      <nav class="category-scroll" aria-label="资产分类">
        <button
          v-for="category in categories"
          :key="category.code"
          class="category-tile"
          :class="{ active: selected === category.code }"
          :disabled="saving"
          @click="selected = category.code"
        >
          <span :style="{ color: category.color }">●</span> {{ category.name
          }}<strong
            :class="{
              'field-error': categoryStatus(category.code) === '存在校验错误',
            }"
            >{{ categoryStatus(category.code) }}</strong><span class="muted">{{
              rows.filter(
                (row) => !row.deleted && row.categoryCode === category.code,
              ).length
            }}
            个账户</span>
        </button>
      </nav>
      <div v-if="restored || dirty || storageError" class="draft-banner">
        <span>{{
          storageError
            ? '设备存储不可用，修改仍保留在当前页面，请勿关闭。'
            : restored
              ? '已恢复本地草稿，尚未提交到家庭账本。'
              : `草稿已保存到本机 ${savedAt}`
        }}</span><button class="text-button" :disabled="saving" @click="discard">
          放弃草稿
        </button>
      </div>
      <div class="help-box">
        <strong>{{ currentCategory?.name }}</strong>
        <p>{{ currentCategory?.description }}</p>
        <p>
          金额为空表示待填写；明确没有余额时请填写 0。所有金额以人民币计算。
        </p>
      </div>
      <div class="filters mb-5">
        <label for="asset-update-date">记账日期</label><input
          id="asset-update-date"
          v-model="updateDate"
          type="date"
          :max="today()"
          :disabled="saving"
        /><span class="muted">当日多次更新保留最后快照，更新明细逐次保留。</span>
      </div>
      <section
        v-for="member in context.members"
        :key="member.id"
        class="asset-card member-section"
      >
        <div class="section-heading">
          <div class="category-title">
            <span
              class="category-icon"
              style="color: #3b82f6; background: #eef4ff"
              ><IconifyIcon icon="lucide:user-round" /></span>
            <h2>{{ member.displayName }}</h2>
            <span
              v-if="!context.owner && member.id !== context.currentMemberId"
              class="muted"
              >只读</span>
          </div>
          <span>{{ money(total(selected, member.id)) }}</span>
        </div>
        <div
          v-for="row in rows
            .filter(
              (item) =>
                item.memberId === member.id &&
                item.categoryCode === selected &&
                !item.deleted,
            )
            .sort((first, second) => first.sortOrder - second.sortOrder)"
          :key="row.key"
          class="account-row"
        >
          <div>
            <button
              class="account-title"
              :disabled="saving || !canEdit(row)"
              @click="edit(row)"
            >
              {{ row.name }} <span v-if="canEdit(row)" class="muted">↗</span>
            </button>
            <p class="muted">
              {{ row.dataDate }} ·
              {{ dictionaryLabel('sources', row.sourceType) }}
            </p>
          </div>
          <div>
            <input
              v-if="canEdit(row)"
              v-model="row.balance"
              :disabled="saving"
              class="account-amount"
              :type="hidden ? 'password' : 'text'"
              inputmode="decimal"
              maxlength="20"
              :aria-label="`${row.name}余额`"
              :placeholder="hidden ? '**** 元' : '待填写'"
            /><span v-else>{{ money(row.balance) }}</span>
            <div v-if="error(row)" class="field-error">{{ error(row) }}</div>
          </div>
          <div v-if="canEdit(row)" class="account-tools">
            <button
              class="text-button"
              :disabled="saving"
              :aria-label="`上移${row.name}`"
              @click="move(row, -1)"
            >
              ↑
</button><button
              class="text-button"
              :disabled="saving"
              :aria-label="`下移${row.name}`"
              @click="move(row, 1)"
            >
              ↓
</button><button class="text-button" :disabled="saving" @click="edit(row)">
              编辑
</button><button
              class="text-button"
              style="color: #d17878"
              :disabled="saving"
              @click="remove(row)"
            >
              删除
            </button>
          </div>
        </div>
        <p
          v-if="
            !rows.some(
              (item) =>
                !item.deleted &&
                item.memberId === member.id &&
                item.categoryCode === selected,
            )
          "
          class="muted py-6"
        >
          还没有{{ currentCategory?.name }}账户
        </p>
        <button
          v-if="context.owner || member.id === context.currentMemberId"
          class="text-button mt-4"
          :disabled="saving"
          @click="add(member.id)"
        >
          ＋ 添加{{ currentCategory?.name }}
        </button>
      </section>
      <div v-if="rows.some((row) => row.deleted)" class="draft-banner">
        <span>{{
            rows.filter((row) => row.deleted).length
          }}
          个账户待删除，完成更新后生效</span><button
          class="text-button"
          :disabled="saving"
          @click="
            rows.forEach((row) => {
              row.deleted = false;
            })
          "
        >
          撤销删除
        </button>
      </div>
      <footer class="bottom-actions">
        <button class="text-button" @click="hidden = !hidden">
          <IconifyIcon
            :icon="hidden ? 'lucide:eye-off' : 'lucide:shield-check'"
            class="mr-1 inline-block"
          />隐私保护
        </button>
        <div class="flex items-center gap-4">
          <span class="muted hidden sm:inline">第 {{ index + 1 }} / {{ categories.length }} 类 ·
            {{ changes.length }} 项修改</span><button
            v-if="!finalStep"
            class="primary-button"
            :disabled="saving"
            @click="next"
          >
            下一类 →
</button><button
            v-else
            class="primary-button"
            :disabled="saving || !dirty"
            @click="submit"
          >
            {{ saving ? '正在保存…' : '完成更新' }}
          </button>
        </div>
      </footer>
    </template>
    <Modal
      v-model:open="modalOpen"
      :title="modalIndex < 0 ? '添加资产账户' : '编辑资产账户'"
      :width="620"
      ok-text="保存到草稿"
      cancel-text="取消"
      @ok="saveForm"
    >
      <div v-if="form" class="finance-form my-5">
        <label
          v-if="modalIndex < 0 && form.categoryCode === 'liquid'"
          class="wide"
          >账户模板<select v-model="chosenTemplate">
            <option value="">自定义账户</option>
            <option
              v-for="template in templates"
              :key="template.value"
              :value="template.value"
              :disabled="template.disabled"
            >
              {{ template.label }}
            </option>
          </select></label>
        <label class="wide">账户名称<input
            v-model="form.name"
            maxlength="80"
            placeholder="例如：工资卡、住房估值"
        /></label>
        <label>余额 / 估值（元）<input
            v-model="form.balance"
            inputmode="decimal"
            :type="hidden ? 'password' : 'text'"
            maxlength="20"
            placeholder="待填写，区别于 0"
        /></label>
        <label>所属成员<select v-model="form.memberId">
            <option
              v-for="member in editableMembers"
              :key="member.id"
              :value="member.id"
            >
              {{ member.displayName }}
            </option>
          </select></label>
        <label>资产分类<select
            v-model="form.categoryCode"
            :disabled="!!form.templateCode"
          >
            <option
              v-for="category in categories"
              :key="category.code"
              :value="category.code"
            >
              {{ category.name }}
            </option>
          </select></label>
        <label>四笔钱归属<select
            v-model="form.fundBucket"
            :disabled="form.categoryCode === 'liability'"
          >
            <option :value="null">暂不分配</option>
            <option
              v-for="bucket in bucketOptions"
              :key="bucket.value"
              :value="bucket.value"
              :disabled="bucket.disabled"
            >
              {{ bucket.label }}
            </option>
          </select></label>
        <label v-if="form.fundBucket === 'insurance'">保险类型<select v-model="form.insuranceType">
            <option :value="null">暂不设置</option>
            <option
              v-for="type in insuranceTypes"
              :key="type.value"
              :value="type.value"
              :disabled="type.disabled"
            >
              {{ type.label }}
            </option>
          </select></label>
        <label>数据日期<input v-model="form.dataDate" type="date" :max="today()" /></label>
        <label class="wide">备注<textarea
            v-model="form.remark"
            maxlength="500"
            rows="2"
            placeholder="选填"
          ></textarea>
        </label>
        <p v-if="formError" class="wide" style="color: #d35e5e">
          {{ formError }}
        </p>
      </div>
    </Modal>
  </main>
</template>
