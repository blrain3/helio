-- M4: PaymentStatus 枚举追加 REFUNDED（全额退款后状态）
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUNDED';
