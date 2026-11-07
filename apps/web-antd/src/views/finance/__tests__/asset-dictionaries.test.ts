import type { AssetContext } from '../../../api/finance/assets';

import { ref } from 'vue';

import { expect, it } from 'vitest';

import { useAssetDictionaries } from '../use-asset-dictionaries';

it('字典加载后响应标签、停用状态和用途展示配置，并保留未知历史编码', () => {
  const context = ref<AssetContext>();
  const dictionaries = useAssetDictionaries(context);
  expect(dictionaries.templates.value).toEqual([]);
  expect(dictionaries.label('insuranceTypes', '历史保险')).toBe('历史保险');
  context.value = {
    userId: 1,
    tenantId: 1,
    family: null,
    owner: false,
    currentMemberId: 1,
    members: [],
    categories: [],
    maxBalance: '999999999999.99',
    options: {
      categories: [],
      templates: [
        {
          value: 'card',
          label: '储蓄卡',
          disabled: true,
          color: '',
          description: '',
        },
      ],
      buckets: [
        {
          value: 'stable',
          label: '稳健配置',
          disabled: false,
          color: '#123456',
          description: '三年内',
        },
      ],
      insuranceTypes: [],
      sources: [],
      operations: [],
    },
  };
  expect(dictionaries.templates.value[0]?.disabled).toBe(true);
  expect(dictionaries.label('templates', 'card')).toBe('储蓄卡');
  expect(dictionaries.bucketOptions.value[0]?.description).toBe('三年内');
  context.value.options.templates[0]!.label = '银行卡';
  expect(dictionaries.label('templates', 'card')).toBe('银行卡');
  expect(dictionaries.label('sources', null)).toBe('');
});
