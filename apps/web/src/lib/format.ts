/** 展示格式化工具。金额以「分」存储，展示为「元」。 */

/** 分 → 元 字符串（¥ + 千分位 + 2 位小数）。 */
export function fenToYuan(fen: number): string {
  const yuan = fen / 100;
  return `¥${yuan.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** ISO 时间 → `YYYY-MM-DD HH:mm`。 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** 状态文案映射（中文）。 */
const STATUS_LABELS: Record<string, string> = {
  ONLINE: '在线',
  OFFLINE: '离线',
  FAULT: '故障',
  DRAFT: '草稿',
  ISSUED: '已出账',
  PAID: '已支付',
  OVERDUE: '逾期',
  CREATED: '待支付',
  PENDING: '支付中',
  SUCCESS: '支付成功',
  FAILED: '失败',
  CLOSED: '已关闭',
  REFUNDED: '已退款',
  OPEN: '未解决',
  RESOLVED: '已解决',
  MISSING_DATA: '数据缺失',
  ENERGY_SPIKE: '发电异常',
  DEVICE_OFFLINE: '设备离线',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/** 状态徽标配色（Tailwind 类名）。 */
export function statusTone(status: string): string {
  switch (status) {
    case 'ONLINE':
    case 'SUCCESS':
    case 'PAID':
    case 'RESOLVED':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
    case 'FAULT':
    case 'FAILED':
    case 'OVERDUE':
    case 'HIGH':
      return 'bg-rose-50 text-rose-700 ring-rose-600/20';
    case 'OFFLINE':
    case 'CLOSED':
    case 'DRAFT':
      return 'bg-slate-100 text-slate-600 ring-slate-500/20';
    case 'PENDING':
    case 'CREATED':
    case 'ISSUED':
    case 'OPEN':
    case 'MEDIUM':
      return 'bg-amber-50 text-amber-700 ring-amber-600/20';
    case 'REFUNDED':
    case 'LOW':
      return 'bg-sky-50 text-sky-700 ring-sky-600/20';
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-500/20';
  }
}
