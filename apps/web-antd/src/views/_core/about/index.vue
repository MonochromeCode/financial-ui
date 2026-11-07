<script lang="ts" setup>
import { Page } from '@vben/common-ui';
import { preferences } from '@vben/preferences';

defineOptions({ name: 'About' });
</script>

<template>
  <Page :title="preferences.app.name" />
</template>
