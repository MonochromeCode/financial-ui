import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:layout-dashboard',
      order: -1,
      title: '资产管理',
    },
    name: 'Dashboard',
    path: '/dashboard',
    children: [
      {
        name: 'Workspace',
        path: 'workspace',
        component: () => import('#/views/finance/index.vue'),
        meta: {
          affixTab: true,
          icon: 'carbon:workspace',
          title: '家庭资产',
        },
      },
    ],
  },
  {
    name: 'FamilyAssetEdit',
    path: '/finance/assets/edit',
    component: () => import('#/views/finance/edit.vue'),
    meta: {
      title: '更新家庭资产',
      hideInMenu: true,
      keepAlive: false,
      activePath: '/dashboard/workspace',
    },
  },
  {
    name: 'FamilyAssetManage',
    path: '/finance/assets/manage',
    component: () => import('#/views/finance/manage.vue'),
    meta: {
      title: '家庭账本管理',
      hideInMenu: true,
      keepAlive: false,
      activePath: '/dashboard/workspace',
    },
  },
  {
    name: 'Profile',
    path: '/profile',
    component: () => import('#/views/_core/profile/index.vue'),
    meta: {
      icon: 'ant-design:profile-outlined',
      title: $t('ui.widgets.profile'),
      hideInMenu: true,
      fullPathKey: false, // 社交绑定回调后会去掉地址中的 code 等参数，使用 path 作为标签页 key，保证更新原标签页，且不重建页面
    },
  },
];

export default routes;
