import { ref, watch } from 'vue';
import dayjs from 'dayjs';

export const bucketOptions = [
  { value: 'liquid', label: '活钱', term: '1 年以内', color: '#3b82f6' },
  { value: 'stable', label: '稳健资金', term: '1～5 年', color: '#14b8a6' },
  { value: 'long_term', label: '长期资金', term: '5 年以上', color: '#a78bfa' },
  { value: 'insurance', label: '保险保障', term: '保障期限', color: '#f59e0b' },
];
export const templates = [
  { value: 'bank', label: '银行活期' },
  { value: 'card', label: '银行卡' },
  { value: 'cash', label: '现金' },
  { value: 'alipay', label: '支付宝' },
  { value: 'wechat', label: '微信钱包' },
  { value: 'ecny', label: '数字人民币' },
];
export const today = () => dayjs().format('YYYY-MM-DD');
export const displayDate = (value?: string | null) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '尚未更新';
export function cents(value: string | null | undefined): bigint {
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
  value: string | null | undefined,
  hidden = false,
): string {
  if (hidden) return '**** 元';
  if (value === null || value === undefined || value === '') return '待填写';
  const [integer = '0', fraction = '00'] = decimal(cents(String(value))).split(
    '.',
  );
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction} 元`;
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
