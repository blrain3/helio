"""
M4 支付系统端到端冒烟测试。

链路：登录 → 查电站 → 生成账单 → 出账 → 创建订单 → 提交支付 → 创建支付(下单)
     → 模拟回调(验签) → 幂等回调 → 退款(部分) → 退款(全额→REFUNDED) → 日对账

说明：Helio API 所有接口直接返回对象/数组（无 data 包裹）。
"""
import json
import hashlib
import time
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:3000/api"
SECRET = "helio-mock-secret"

PASS = []
FAIL = []


def check(name, cond, detail=""):
    if cond:
        PASS.append(name)
        print(f"  [PASS] {name}")
    else:
        FAIL.append(name)
        print(f"  [FAIL] {name} {detail}")


def req(method, path, token=None, body=None):
    url = BASE + path
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            code = resp.status
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        code = e.code
        raw = e.read().decode("utf-8")
    try:
        return code, json.loads(raw) if raw else None
    except json.JSONDecodeError:
        return code, raw


def sign(merchant_order_id, provider_txn_id, amount):
    raw = f"{merchant_order_id}{provider_txn_id}{amount}{SECRET}"
    return hashlib.sha256(raw.encode()).hexdigest()


def main():
    print("=" * 60)
    print("M4 支付系统 端到端冒烟测试")
    print("=" * 60)

    # 1. 登录
    code, res = req("POST", "/auth/login", body={"email": "admin@helio.io", "password": "admin123456", "deviceId": "smoke-test-device"})
    check("登录返回 200/201", code in (200, 201), f"got {code}")
    tokens = (res or {}).get("tokens") if isinstance(res, dict) else None
    token = tokens.get("accessToken") if isinstance(tokens, dict) else None
    check("获取 accessToken", bool(token), f"res={res}")
    if not token:
        print("无 token，终止测试")
        return

    # 2. 查电站（直接返回数组）
    code, res = req("GET", "/plants", token=token)
    check("查询电站 200", code == 200, f"got {code}")
    plants = res if isinstance(res, list) else []
    plant_id = plants[0]["id"] if plants else None
    check("获取电站 id", bool(plant_id), f"plants={plants}")

    # 3. 生成账单（直接返回对象）
    code, res = req("POST", "/bills", token=token, body={
        "plantId": plant_id,
        "consumedKwh": 100,
        "periodStart": "2026-08-01T00:00:00.000Z",
        "periodEnd": "2026-08-31T23:59:59.000Z",
    })
    check("生成账单 201", code == 201, f"got {code} res={res}")
    bill = res if isinstance(res, dict) else {}
    bill_id = bill.get("id")
    bill_amount = bill.get("totalAmount")
    check("获取账单 id", bool(bill_id), f"bill={bill}")
    check("账单金额为 6500 分(100kWh×65分)", bill_amount == 6500, f"totalAmount={bill_amount}")

    # 4. 出账（issue）
    code, res = req("PATCH", f"/bills/{bill_id}/issue", token=token)
    check("出账 200", code == 200, f"got {code} res={res}")

    # 5. 创建订单（amount 须与账单金额一致）
    code, res = req("POST", "/orders", token=token, body={"billId": bill_id, "amount": bill_amount})
    check("创建订单 201", code == 201, f"got {code} res={res}")
    order = res if isinstance(res, dict) else {}
    order_id = order.get("id")
    order_no = order.get("orderNo")
    order_amount = order.get("amount")
    check("获取订单 id/orderNo/amount", bool(order_id and order_no and order_amount), f"order={order}")

    # 6. 提交支付
    code, res = req("PATCH", f"/orders/{order_id}/submit-payment", token=token)
    check("提交支付 200", code == 200, f"got {code} res={res}")

    # 7. 创建支付（下单）
    code, res = req("POST", "/payments", token=token, body={"orderId": order_id, "provider": "mock"})
    check("创建支付 201", code == 201, f"got {code} res={res}")
    payment = res if isinstance(res, dict) else {}
    payment_id = payment.get("id")
    provider_txn_id = payment.get("providerTransactionId")
    check("获取支付 id/渠道交易号", bool(payment_id and provider_txn_id), f"payment={payment}")

    # 8. 模拟成功回调（正确签名）
    sig = sign(order_no, provider_txn_id, order_amount)
    cb = {
        "provider": "mock",
        "providerTransactionId": provider_txn_id,
        "merchantOrderId": order_no,
        "amount": order_amount,
        "status": "SUCCESS",
        "signature": sig,
        "rawPayload": {"provider": "mock", "status": "SUCCESS"},
    }
    code, res = req("POST", "/payments/callback", body=cb)
    check("回调(验签) 200", code == 200, f"got {code} res={res}")
    ack = (res or {}).get("ack") if isinstance(res, dict) else None
    check("回调返回 ACK ok", ack == "ok", f"res={res}")

    # 9. 查询支付：应 SUCCESS
    code, res = req("GET", f"/payments/{payment_id}", token=token)
    pay = res if isinstance(res, dict) else {}
    check("支付状态为 SUCCESS", pay.get("status") == "SUCCESS", f"pay={pay}")

    # 10. 幂等回调（重复通知，应直接 ACK）
    code, res = req("POST", "/payments/callback", body=cb)
    check("幂等回调 200", code == 200, f"got {code} res={res}")

    # 11. 查询订单：应 PAID
    code, res = req("GET", f"/orders/{order_id}", token=token)
    ord_ = res if isinstance(res, dict) else {}
    check("订单状态为 PAID", ord_.get("status") == "PAID", f"order={ord_}")

    # 12. 部分退款
    part = order_amount // 2
    code, res = req("POST", f"/payments/{payment_id}/refund", token=token, body={"amount": part})
    check("部分退款 201", code == 201, f"got {code} res={res}")
    refund = res if isinstance(res, dict) else {}
    check("退款单金额正确", refund.get("amount") == part, f"refund={refund}")

    # 部分退款后支付状态应仍为 SUCCESS
    code, res = req("GET", f"/payments/{payment_id}", token=token)
    pay = res if isinstance(res, dict) else {}
    check("部分退款后状态仍 SUCCESS", pay.get("status") == "SUCCESS", f"pay={pay}")
    check("refundedAmount 累计正确", pay.get("refundedAmount") == part, f"refunded={pay.get('refundedAmount')}")

    # 13. 全额退款（剩余部分）→ 应 REFUNDED
    remaining = order_amount - part
    code, res = req("POST", f"/payments/{payment_id}/refund", token=token, body={"amount": remaining})
    check("全额退款 201", code == 201, f"got {code} res={res}")
    code, res = req("GET", f"/payments/{payment_id}", token=token)
    pay = res if isinstance(res, dict) else {}
    check("全额退款后状态 REFUNDED", pay.get("status") == "REFUNDED", f"pay={pay}")

    # 14. 超额退款应被拒绝（可退金额为 0）
    code, res = req("POST", f"/payments/{payment_id}/refund", token=token, body={"amount": 1})
    check("超额退款被拒绝(400)", code == 400, f"got {code} res={res}")

    # 15. 日对账
    today = time.strftime("%Y-%m-%d")
    code, res = req("POST", "/payments/reconcile/daily", token=token, body={"date": today})
    check("日对账 200", code == 200, f"got {code} res={res}")

    # 汇总
    print("=" * 60)
    print(f"通过: {len(PASS)}  失败: {len(FAIL)}")
    if FAIL:
        print("失败项：")
        for f in FAIL:
            print(f"  - {f}")
    else:
        print("全部通过 ✅")
    print("=" * 60)


if __name__ == "__main__":
    main()
