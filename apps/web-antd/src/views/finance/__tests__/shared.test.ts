import { describe, expect, it } from 'vitest';
import { cents, decimal, formatMoney } from '../shared';

describe('家庭资产金额展示', () => {
  it('以整数分计算大额资产及负净资产，避免浮点精度丢失', () => {
    expect(decimal(cents('999999999999.99') + cents('0.01'))).toBe(
      '1000000000000.00',
    );
    expect(decimal(cents('0.10') + cents('0.20'))).toBe('0.30');
    expect(decimal(cents('10.00') - cents('20.25'))).toBe('-10.25');
  });
  it('区分未填写与明确的零余额', () => {
    expect(formatMoney(null)).toBe('待填写');
    expect(formatMoney('')).toBe('待填写');
    expect(formatMoney('0.00')).toBe('0.00 元');
  });
  it('为大额金额和负数保留两位小数及千分位', () => {
    expect(formatMoney('9999999999999.99')).toBe('9,999,999,999,999.99 元');
    expect(formatMoney('-1234.5')).toBe('-1,234.50 元');
  });
  it('隐私模式对零值、空值和负值统一隐藏', () => {
    for (const amount of ['0.00', null, '-123.45', '999999999999.99']) {
      expect(formatMoney(amount, true)).toBe('**** 元');
    }
  });
});
