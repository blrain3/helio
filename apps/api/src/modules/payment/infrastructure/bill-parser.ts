import { RawStatementRow } from '../domain/payment.entity';
import { PaymentGatewayError } from '../../auth/domain/errors';
import { gunzipSync } from 'zlib';
import { unzipSync } from 'fflate';

/**
 * 渠道对账单解析工具（微信 / 支付宝 CSV → RawStatementRow）。
 *
 * 各渠道对账单下载后为 CSV（微信为 gzip，支付宝为 zip 压缩包）。本模块负责：
 * 1. 解码（gzip 解压 / zip 解包取明细 / 文本直读）
 * 2. 通用 CSV 解析（含引号转义、BOM、CRLF）
 * 3. 按列名映射为统一 RawStatementRow（金额统一为「分」）
 *
 * 字段与单位已按官方文档校准：
 * - 微信「交易账单」：金额列（订单金额 / 应结订单金额）单位为「元」，保留 2 位小数，
 *   需 ×100 转「分」；退款/撤销行由「交易状态」= REFUND / REVOKED 标识；字段值可能
 *   带前导反引号 `（防 Excel 科学计数法），解析时去除。
 * - 支付宝「交易账单」：zip 压缩包内为 CSV，金额列「订单金额(元)」单位为「元」；
 *   退款行由「业务类型」= 交易退款 标识（旧版账务账单用「收/支」= 支出）。
 * 账单文件编码默认 UTF-8；若接入后出现乱码（支付宝旧账单可能为 GBK），需按实际
 * 文件编码补充转码。
 */

/** UTF-8 解码（去除 BOM）。 */
function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
}

/** 解析 CSV 文本为二维数组（去除 BOM、空行，支持引号包裹与 "" 转义）。 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      // 忽略 \r（兼容 CRLF）
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** 解码下载到的账单文件（gzip / zip / 文本），返回 CSV 文本。 */
export function decodeBillBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // gzip（微信交易账单）
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    return gunzipSync(Buffer.from(bytes)).toString('utf-8');
  }
  // zip（支付宝交易账单为压缩包，内含业务明细 + 业务汇总等文件）
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(bytes);
    } catch (err) {
      throw new PaymentGatewayError(`对账单 zip 解压失败：${(err as Error).message}`);
    }
    const names = Object.keys(entries);
    // 取含「商户订单号」的业务明细文件（排除汇总文件）；单文件 zip 直接返回。
    for (const name of names) {
      const text = decodeUtf8(entries[name]!);
      if (text.includes('商户订单号')) {
        return text;
      }
    }
    if (names.length === 1) {
      return decodeUtf8(entries[names[0]!]!);
    }
    throw new PaymentGatewayError('对账单 zip 中未找到含「商户订单号」的业务明细文件');
  }
  return decodeUtf8(bytes);
}

/** 定位表头行（首个包含指定列名的行）并返回表头与数据行。 */
function splitHeader(rows: string[][], requiredHeader: string): { header: string[]; data: string[][] } {
  const headerIdx = rows.findIndex((r) => r.some((c) => c.trim() === requiredHeader));
  if (headerIdx === -1) {
    throw new PaymentGatewayError(`对账单格式不符：缺少表头列「${requiredHeader}」`);
  }
  const header = rows[headerIdx]!.map((c) => c.trim());
  return { header, data: rows.slice(headerIdx + 1) };
}

/** 去除字段值前导反引号并 trim（微信账单字段前会加 ` 防科学计数法）。 */
function stripTick(s: string): string {
  return s.replace(/^`/, '').trim();
}

/** 元 → 分（保留两位小数，四舍五入为整数分）。 */
function yuanToFen(yuan: string): number {
  return Math.round(parseFloat(yuan) * 100);
}

/**
 * 解析微信「交易账单」CSV。
 * 关键列：商户订单号、订单金额（元）/应结订单金额（元）、交易状态、微信订单号、交易时间。
 * 退款/撤销行（交易状态 = REFUND / REVOKED）不参与支付对账，直接跳过；
 * 汇总行（列数远少于明细表头，金额列缺失）自然被跳过。
 */
export function parseWechatTradeBill(text: string): RawStatementRow[] {
  const { header, data } = splitHeader(parseCsv(text), '商户订单号');
  const idx = (name: string) => header.indexOf(name);
  const iOrder = idx('商户订单号');
  // 金额列优先级：订单金额（新版）→ 总金额（旧版）→ 应结订单金额
  const iAmount = ['订单金额', '总金额', '应结订单金额'].map(idx).find((i) => i >= 0) ?? -1;
  const iStatus = idx('交易状态');
  const iTx = idx('微信订单号');
  const iTime = idx('交易时间');
  if (iOrder < 0 || iAmount < 0) {
    throw new PaymentGatewayError('微信对账单格式不符：缺少「商户订单号」或金额列');
  }

  const out: RawStatementRow[] = [];
  for (const r of data) {
    const merchantOrderId = stripTick(r[iOrder] ?? '');
    if (!merchantOrderId || merchantOrderId === '总交易单数') continue;
    const status = iStatus >= 0 ? stripTick(r[iStatus] ?? '') : '';
    // 退款 / 撤销行跳过（仅对支付成功行对账）。
    if (status === 'REFUND' || status === 'REVOKED') continue;
    const yuan = stripTick(r[iAmount] ?? '');
    if (!yuan) continue;
    const amount = yuanToFen(yuan);
    if (!Number.isSafeInteger(amount) || amount <= 0) continue;
    out.push({
      merchantOrderId,
      amount,
      status,
      providerTransactionId: iTx >= 0 ? stripTick(r[iTx] ?? '') : undefined,
      tradeTime: iTime >= 0 ? stripTick(r[iTime] ?? '') : undefined,
    });
  }
  return out;
}

/**
 * 解析支付宝「交易账单」CSV。
 * 关键列：商户订单号、订单金额(元)（元 → 分）、业务类型（交易收款/交易退款）、
 * 支付宝交易号、创建时间。
 * 退款行（业务类型 = 交易退款；旧版账务账单用「收/支」= 支出）跳过。
 */
export function parseAlipayTradeBill(text: string): RawStatementRow[] {
  const { header, data } = splitHeader(parseCsv(text), '商户订单号');
  const idx = (name: string) => header.indexOf(name);
  const iOrder = idx('商户订单号');
  const iAmount = ['订单金额(元)', '金额(元)'].map(idx).find((i) => i >= 0) ?? -1;
  const iBizType = idx('业务类型');
  const iDir = idx('收/支');
  const iTx = idx('支付宝交易号');
  const iTime = idx('创建时间') >= 0 ? idx('创建时间') : idx('交易创建时间');
  if (iOrder < 0 || iAmount < 0) {
    throw new PaymentGatewayError('支付宝对账单格式不符：缺少「商户订单号」或金额列');
  }

  const out: RawStatementRow[] = [];
  for (const r of data) {
    const merchantOrderId = (r[iOrder] ?? '').trim();
    if (!merchantOrderId) continue;
    const bizType = iBizType >= 0 ? (r[iBizType] ?? '').trim() : '';
    const dir = iDir >= 0 ? (r[iDir] ?? '').trim() : '';
    // 退款行跳过（仅对交易收款行对账）。
    if (bizType === '交易退款' || dir === '支出') continue;
    const yuan = (r[iAmount] ?? '').trim();
    if (!yuan) continue;
    const amount = yuanToFen(yuan);
    if (!Number.isSafeInteger(amount) || amount <= 0) continue;
    out.push({
      merchantOrderId,
      amount,
      status: bizType || dir || '交易收款',
      providerTransactionId: iTx >= 0 ? (r[iTx] ?? '').trim() : undefined,
      tradeTime: iTime >= 0 ? (r[iTime] ?? '').trim() : undefined,
    });
  }
  return out;
}
