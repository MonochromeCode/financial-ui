<script lang="ts" setup>
import type { WorkbenchQuickNavItem } from '@vben/common-ui';

import { useRouter } from 'vue-router';

import { WorkbenchHeader, WorkbenchQuickNav } from '@vben/common-ui';
import { preferences } from '@vben/preferences';
const router = useRouter();

const quickNavItems: WorkbenchQuickNavItem[] = [
  {
    color: '#2563eb',
    icon: 'lucide:users',
    title: '用户管理',
    url: '/system/user',
  },
  {
    color: '#16a34a',
    icon: 'lucide:shield-check',
    title: '角色管理',
    url: '/system/role',
  },
  {
    color: '#d97706',
    icon: 'lucide:bell',
    title: '通知公告',
    url: '/system/messages/notice',
  },
];

function navTo(nav: WorkbenchQuickNavItem) {
  if (nav.url) {
    void router.push(nav.url);
  }
}
</script>

<template>
  <div class="p-5">
    <WorkbenchHeader :avatar="preferences.logo.source">
      <template #title>欢迎回来</template>
      <template #description>请选择需要使用的功能。</template>
      <template #actions><span></span></template>
    </WorkbenchHeader>
    <WorkbenchQuickNav
      :items="quickNavItems"
      class="mt-5"
      title="常用功能"
      @click="navTo"
    />
  </div>
</template>
