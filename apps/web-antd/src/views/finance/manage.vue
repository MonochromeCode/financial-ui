<script setup lang="ts">
import type { AssetContext, Category, Member } from '#/api/finance/assets';

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import { message, Modal } from 'ant-design-vue';

import {
  deleteMember,
  getAssetContext,
  saveCategory,
  saveFamily,
  saveMember,
} from '#/api/finance/assets';

import './finance.css';

const router = useRouter();
const context = ref<AssetContext>();
const loading = ref(true);
const failed = ref(false);
const saving = ref(false);
const familyName = ref('');
const allowViewOthers = ref(false);
const memberOpen = ref(false);
const categoryOpen = ref(false);
const memberForm = ref<Partial<Member>>({
  displayName: '',
  userId: null,
  sortOrder: 0,
});
const categoryForm = ref<Category>();
const formError = ref('');
async function load() {
  loading.value = true;
  failed.value = false;
  try {
    context.value = await getAssetContext();
    if (!context.value.family) {
      await router.replace('/dashboard/workspace');
      return;
    }
    familyName.value = context.value.family.name;
    allowViewOthers.value = !!context.value.family.allowViewOthers;
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}
async function family() {
  if (saving.value || !familyName.value.trim()) return;
  saving.value = true;
  try {
    await saveFamily({
      name: familyName.value.trim(),
      allowViewOthers: allowViewOthers.value,
    });
    message.success('家庭配置已保存');
    await load();
  } finally {
    saving.value = false;
  }
}
function editMember(member?: Member) {
  memberForm.value = member
    ? { ...member }
    : {
        displayName: '',
        userId: null,
        sortOrder: context.value?.members.length || 0,
      };
  formError.value = '';
  memberOpen.value = true;
}
async function member() {
  if (saving.value) return;
  if (!memberForm.value.displayName?.trim()) {
    formError.value = '请输入成员名称';
    return;
  }
  saving.value = true;
  try {
    await saveMember({
      ...memberForm.value,
      userId: memberForm.value.userId || null,
    });
    memberOpen.value = false;
    message.success('成员已保存');
    await load();
  } finally {
    saving.value = false;
  }
}
function remove(member: Member) {
  Modal.confirm({
    title: `删除成员“${member.displayName}”？`,
    content: '仅支持删除尚无账户及历史快照的成员。',
    okText: '删除',
    cancelText: '取消',
    okType: 'danger',
    async onOk() {
      await deleteMember(member.id);
      await load();
    },
  });
}
function editCategory(category: Category) {
  categoryForm.value = { ...category };
  formError.value = '';
  categoryOpen.value = true;
}
async function category() {
  if (saving.value || !categoryForm.value) return;
  const item = categoryForm.value;
  if (
    !item.name.trim() ||
    !item.icon.trim() ||
    !item.description.trim() ||
    !/^#[\da-fA-F]{6}$/.test(item.color)
  ) {
    formError.value = '请填写名称、图标、分类说明和有效主题色';
    return;
  }
  saving.value = true;
  try {
    await saveCategory(item);
    categoryOpen.value = false;
    message.success('分类配置已保存');
    await load();
  } finally {
    saving.value = false;
  }
}
onMounted(load);
</script>

<template>
  <main class="finance-page">
    <header class="page-heading">
      <div>
        <div class="eyebrow">理财有数 · FAMILY SETTINGS</div>
        <h1>家庭账本管理</h1>
        <p class="muted">
          当前系统用户编号：{{ context?.userId }} ·
          {{ context?.owner ? '家庭所有者' : '家庭成员' }}
        </p>
      </div>
      <button
        class="secondary-button"
        @click="router.push('/dashboard/workspace')"
      >
        返回首页
      </button>
    </header>
    <div v-if="loading" class="skeleton"></div>
    <div v-else-if="failed" class="error-card">
      家庭配置加载失败。<button class="text-button" @click="load">重试</button>
    </div>
    <div v-else-if="context?.family" class="asset-grid">
      <section class="asset-card full-width">
        <div class="section-heading">
          <h2>家庭与访问权限</h2>
          <IconifyIcon
            icon="lucide:shield-check"
            class="text-xl text-blue-500"
          />
        </div>
        <div class="finance-form">
          <label>家庭名称<input
              v-model="familyName"
              maxlength="80"
              :disabled="!context.owner || saving"
          /></label>
          <div>
            <p class="mb-3">成员访问范围</p>
            <label
              style="display: flex; flex-direction: row; align-items: center"
              ><input
                v-model="allowViewOthers"
                type="checkbox"
                style="width: auto"
                :disabled="!context.owner || saving"
              />允许普通成员查看全体家庭资产</label>
            <p class="muted mt-3">
              关闭后，普通成员只能查看自己的金额；编辑始终仅限本人。
            </p>
          </div>
        </div>
        <div class="help-box">
          所有者可以维护全部成员的资产与配置。关联系统用户后，对方登录即可进入这个家庭账本；未关联的成员由所有者代为记录。
        </div>
        <button
          v-if="context.owner"
          class="primary-button"
          :disabled="saving || !familyName.trim()"
          @click="family"
        >
          {{ saving ? '正在保存…' : '保存家庭配置' }}
        </button>
        <p v-else class="muted">家庭配置由所有者管理。</p>
      </section>
      <section class="asset-card">
        <div class="section-heading">
          <h2>家庭成员</h2>
          <button
            v-if="context.owner"
            class="text-button"
            @click="editMember()"
          >
            ＋ 新增成员
          </button>
        </div>
        <div class="manage-list">
          <div
            v-for="item in context.members"
            :key="item.id"
            class="manage-item"
          >
            <span class="category-icon member-icon">
              <IconifyIcon icon="lucide:user-round" />
            </span>
            <div class="manage-name">
              <h3>{{ item.displayName }}</h3>
              <p class="muted mt-1">
                {{ item.role === 'owner' ? '所有者' : '成员' }} ·
                {{ item.userId ? `关联用户 #${item.userId}` : '尚未关联用户' }}
              </p>
            </div>
            <template v-if="context.owner">
<button class="text-button" @click="editMember(item)">
                编辑
</button><button
                v-if="item.role !== 'owner'"
                class="text-button"
                style="color: #d17878"
                @click="remove(item)"
              >
                删除
              </button>
</template>
          </div>
        </div>
      </section>
      <section class="asset-card">
        <div class="section-heading">
          <h2>资产分类</h2>
          <span class="muted">预置五大类 · 可配置展示</span>
        </div>
        <div class="manage-list">
          <div
            v-for="item in context.categories"
            :key="item.id"
            class="manage-item"
          >
            <span
              class="category-icon"
              :style="{ color: item.color, background: `${item.color}14` }"
              >●</span>
            <div class="manage-name">
              <h3>{{ item.name }}</h3>
              <p class="muted mt-1">
                {{ item.enabled ? '已启用' : '已停用' }} · 排序
                {{ item.sortOrder }}
              </p>
            </div>
            <button
              v-if="context.owner"
              class="text-button"
              @click="editCategory(item)"
            >
              配置
            </button>
          </div>
        </div>
      </section>
    </div>
    <Modal
      v-model:open="memberOpen"
      :title="memberForm.id ? '编辑家庭成员' : '新增家庭成员'"
      ok-text="保存"
      cancel-text="取消"
      :confirm-loading="saving"
      @ok="member"
      >
<div class="finance-form my-5">
        <label class="wide">成员名称<input
            v-model="memberForm.displayName"
            maxlength="40"
            placeholder="例如：爱人、孩子"
/></label><label>关联的系统用户编号<input
            v-model.number="memberForm.userId"
            type="number"
            min="1"
            :disabled="memberForm.role === 'owner'"
            placeholder="选填"
/></label><label>排序<input
            v-model.number="memberForm.sortOrder"
            type="number"
            min="0"
            max="10000"
        /></label>
        <p class="wide muted" style="font-size: 12px">
          请让对方在家庭账本页面查看自己的系统用户编号。每个系统用户只能关联一个家庭成员；留空表示由所有者代为记录。
        </p>
        <p v-if="formError" class="wide" style="color: #d35e5e">
          {{ formError }}
        </p>
      </div>
</Modal>
    <Modal
      v-model:open="categoryOpen"
      title="配置资产分类"
      ok-text="保存"
      cancel-text="取消"
      :confirm-loading="saving"
      @ok="category"
      >
<div v-if="categoryForm" class="finance-form my-5">
        <label>分类名称<input v-model="categoryForm.name" maxlength="40" /></label><label>主题色<input v-model="categoryForm.color" type="color" /></label><label>图标<select v-model="categoryForm.icon">
            <option value="wallet">钱包</option>
            <option value="house">房屋</option>
            <option value="chart">趋势</option>
            <option value="handshake">应收款</option>
            <option value="credit-card">银行卡</option>
            <option value="landmark">银行</option>
            <option value="gem">珍藏</option>
          </select></label><label>排序<input
            v-model.number="categoryForm.sortOrder"
            type="number"
            min="0"
            max="10000"
/></label><label class="wide">分类说明<textarea
            v-model="categoryForm.description"
            rows="3"
            maxlength="400"
          ></textarea></label><label class="wide" style="flex-direction: row; align-items: center"><input
            v-model="categoryForm.enabled"
            type="checkbox"
            style="width: auto"
          />启用该分类</label>
        <p class="wide" style="font-size: 12px; color: #8090a6">
          分类口径保持不变。停用前请先转移或删除该分类下的全部账户。
        </p>
        <p v-if="formError" class="wide" style="color: #d35e5e">
          {{ formError }}
        </p>
      </div>
</Modal>
  </main>
</template>
