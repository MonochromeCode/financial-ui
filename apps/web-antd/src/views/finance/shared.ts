import { ref, watch } from 'vue';

import dayjs from 'dayjs';

export const today = () => dayjs().format('YYYY-MM-DD');
export const displayDate = (value?: null | string) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '尚未更新';
export function cents(value: null | string | undefined): bigint {
  if (!value || !/^-?\d+(\.\d{1,2})?$/.test(value)) return 0n;
  const negative = value.startsWith('-');
  const [integer = '0', fraction = ''] = value.replace('-', '').split('.');
  const result = BigInt(integer) * 100n + BigInt(fraction.padEnd(2, '0'));
  return negative ? -result : result;
}
export function decimal(value: bigint): string {
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}
export function formatMoney(
  value: null | string | undefined,
  hidden = false,
): string {
  if (hidden) return '**** 元';
  if (value === null || value === undefined || value === '') return '待填写';
  const [integer = '0', fraction = '00'] = decimal(cents(value)).split('.');
  return `${integer.replaceAll(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction} 元`;
}
export function usePrivacy() {
  let initial = false;
  try {
    initial = localStorage.getItem('financial-assets-privacy') === 'true';
  } catch {}
  const hidden = ref(initial);
  watch(hidden, (value) => {
    try {
      localStorage.setItem('financial-assets-privacy', String(value));
    } catch {}
  });
  return hidden;
}
