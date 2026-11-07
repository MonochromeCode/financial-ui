import type { Ref } from 'vue';

import type {
  AssetContext,
  AssetDictionaryOptions,
} from '#/api/finance/assets';

import { computed } from 'vue';

export function useAssetDictionaries(context: Ref<AssetContext | undefined>) {
  const options = (type: keyof AssetDictionaryOptions) =>
    context.value?.options?.[type] || [];
  const label = (
    type: keyof AssetDictionaryOptions,
    value: null | string | undefined,
  ) => options(type).find((item) => item.value === value)?.label || value || '';
  return {
    bucketOptions: computed(() => options('buckets')),
    templates: computed(() => options('templates')),
    insuranceTypes: computed(() => options('insuranceTypes')),
    label,
  };
}
