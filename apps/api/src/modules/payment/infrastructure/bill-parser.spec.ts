import { describe, it, expect } from 'vitest';
import { gzipSync } from 'zlib';
import { zipSync, strToU8 } from 'fflate';
import {
  parseCsv,
  decodeBillBuffer,
  parseWechatTradeBill,
  parseAlipayTradeBill,
} from './bill-parser';
import { PaymentGatewayError } from '../../auth/domain/errors';

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

describe('parseCsv', () => {
  it('解析带引号、转义引号、BOM、CRLF 的 CSV', () => {
    const text = '\uFEFFa,"b,c","d""e"\r\nf,g\r\n';
    expect(parseCsv(text)).toEqual([
      ['a', 'b,c', 'd"e'],
      ['f', 'g'],
    ]);
  });

  it('过滤空行', () => {
    expect(parseCsv('a,b\n\n  ,  \n')).toEqual([['a', 'b']]);
  });
});

describe('decodeBillBuffer', () => {
  it('gzip 解压', () => {
    const csv = '商户订单号,订单金额\nORD1,10.00\n';
    const text = decodeBillBuffer(toArrayBuffer(gzipSync(Buffer.from(csv))));
    expect(text).toContain('商户订单号');
  });

  it('zip 解包并取含「商户订单号」的明细文件', () => {
    const zip = zipSync({
      '业务汇总.csv': strToU8('总金额,10.00\n'),
      '业务明细.csv': strToU8('商户订单号,订单金额(元)\nORD1,10.00\n'),
    });
    const text = decodeBillBuffer(toArrayBuffer(zip));
    expect(text).toContain('商户订单号');
    expect(text).toContain('ORD1');
  });

  it('多文件 zip 内无明细文件时抛 PaymentGatewayError', () => {
    const zip = zipSync({
      '汇总.csv': strToU8('总金额,10.00\n'),
      '说明.txt': strToU8('无账单数据\n'),
    });
    expect(() => decodeBillBuffer(toArrayBuffer(zip))).toThrow(PaymentGatewayError);
  });

  it('纯文本直读', () => {
    const text = decodeBillBuffer(toArrayBuffer(new TextEncoder().encode('a,b\n1,2\n')));
    expect(text).toBe('a,b\n1,2\n');
  });
});

describe('parseWechatTradeBill', () => {
  const header = '交易时间,微信订单号,商户订单号,交易状态,订单金额';
  const csv = [
    header,
    '`2026-09-02 10:00:00,`4200001,`ORD-1001,`SUCCESS,`10.00',
    '`2026-09-02 10:05:00,`4200002,`ORD-1002,`REFUND,`5.00',
    '`2026-09-02 10:10:00,`4200003,`ORD-1003,`REVOKED,`2.00',
  ].join('\n');

  it('金额 元 → 分，去除前导反引号，跳过退款/撤销行', () => {
    const rows = parseWechatTradeBill(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      merchantOrderId: 'ORD-1001',
      amount: 1000, // 10.00 元 → 1000 分
      status: 'SUCCESS',
      providerTransactionId: '4200001',
      tradeTime: '2026-09-02 10:00:00',
    });
  });

  it('缺少表头时抛 PaymentGatewayError', () => {
    expect(() => parseWechatTradeBill('a,b\n1,2\n')).toThrow(PaymentGatewayError);
  });
});

describe('parseAlipayTradeBill', () => {
  const csv = [
    '支付宝交易号,商户订单号,业务类型,创建时间,订单金额(元)',
    '20260902100000,ORD-2001,交易收款,2026-09-02 10:00:00,10.50',
    '20260902100500,ORD-2002,交易退款,2026-09-02 10:05:00,5.00',
  ].join('\n');

  it('金额 元 → 分，跳过「交易退款」行', () => {
    const rows = parseAlipayTradeBill(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      merchantOrderId: 'ORD-2001',
      amount: 1050, // 10.50 元 → 1050 分
      status: '交易收款',
      providerTransactionId: '20260902100000',
      tradeTime: '2026-09-02 10:00:00',
    });
  });

  it('旧版「收/支=支出」行跳过', () => {
    const legacy = [
      '支付宝交易号,商户订单号,收/支,金额(元)',
      'T1,ORD-3001,收入,3.00',
      'T2,ORD-3002,支出,1.00',
    ].join('\n');
    const rows = parseAlipayTradeBill(legacy);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ merchantOrderId: 'ORD-3001', amount: 300 });
  });
});
