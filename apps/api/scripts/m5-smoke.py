"""
M5 异常检测系统端到端冒烟测试。

链路：登录(admin) → 创建阈值规则 → 触发检测(命中) → 查询异常事件
     → 创建突降规则 → 触发检测(未命中) → 触发检测(命中) → 更新规则(版本+1)
     → 删除规则 → 无规则检测返回空

说明：Helio API 所有接口直接返回对象/数组（无 data 包裹）。
      anomaly-rules 与 anomaly/detect 端点需 OPERATOR/ADMIN 角色。
"""
import json
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:3000/api"
ADMIN_EMAIL = "admin@helio.io"
ADMIN_PWD = "admin123456"
PLANT_ID = "00000000-0000-4000-8000-000000000001"
DEVICE_ID = None  # 运行时从电站设备列表获取

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


def main():
    print("=" * 60)
    print("M5 异常检测系统冒烟测试")
    print("=" * 60)

    # 1. 登录
    code, login = req("POST", "/auth/login", body={
        "email": ADMIN_EMAIL, "password": ADMIN_PWD, "deviceId": "smoke-test-device",
    })
    token = ((login or {}).get("tokens") or {}).get("accessToken", "")
    check("登录 admin", code in (200, 201) and bool(token),
          f"code={code} resp={login}")
    if not token:
        print("无法获取 token，终止。")
        return finish()

    # 2. 查询电站设备（获取 deviceId）
    code, devices = req("GET", f"/plants/{PLANT_ID}/devices", token=token)
    global DEVICE_ID
    if code == 200 and isinstance(devices, list) and devices:
        DEVICE_ID = devices[0].get("id")
    check("查询电站设备", code == 200 and DEVICE_ID is not None, f"code={code}")

    # 3. 写入若干发电记录（构造历史窗口）
    records_written = 0
    if DEVICE_ID:
        import datetime
        base = datetime.datetime.utcnow() - datetime.timedelta(hours=2)
        # 先写 4 条历史（约 5 kWh），再检测当前 0.3（触发阈值 LT 1）
        for i in range(4):
            ts = (base + datetime.timedelta(minutes=i * 15)).isoformat() + "Z"
            c, _ = req("POST", "/energy-records", token=token, body={
                "deviceId": DEVICE_ID, "plantId": PLANT_ID,
                "generationKwh": 5.0 + i * 0.1, "timestamp": ts,
            })
            records_written += 1 if c in (200, 201) else 0
    check("写入历史发电记录", records_written == 4, f"written={records_written}")

    # 4. 创建阈值规则
    code, rule = req("POST", "/anomaly-rules", token=token, body={
        "name": "低发电量告警",
        "condition": {"type": "threshold", "metric": "generationKwh", "operator": "LT", "threshold": 1},
        "severity": "WARNING",
    })
    check("创建阈值规则", code in (200, 201) and isinstance(rule, dict) and "id" in rule,
          f"code={code} resp={rule}")
    rule_id = (rule or {}).get("id")

    # 5. 查询规则列表
    code, rules = req("GET", "/anomaly-rules", token=token)
    check("查询规则列表", code == 200 and isinstance(rules, list) and len(rules) >= 1, f"code={code}")

    # 6. 触发检测（当前观测 0.3，命中阈值规则）
    code, events = req("POST", "/anomaly/detect", token=token, body={
        "plantId": PLANT_ID, "value": 0.3,
    })
    hit_threshold = (
        code in (200, 201) and isinstance(events, list) and len(events) > 0
        and any(e.get("ruleId") == rule_id for e in events)
    )
    check("触发检测命中阈值规则", hit_threshold, f"code={code} events={events}")

    # 7. 查询异常事件
    import datetime
    now = datetime.datetime.utcnow()
    start = (now - datetime.timedelta(hours=3)).isoformat() + "Z"
    end = (now + datetime.timedelta(hours=1)).isoformat() + "Z"
    code, events = req("GET", f"/plants/{PLANT_ID}/anomaly-events?start={start}&end={end}", token=token)
    check("查询异常事件列表", code == 200 and isinstance(events, list) and len(events) >= 1, f"code={code}")

    # 8. 更新规则（版本 +1）
    code, updated = req("PATCH", f"/anomaly-rules/{rule_id}", token=token, body={"name": "低发电量告警v2"})
    check("更新规则版本+1", code == 200 and isinstance(updated, dict) and updated.get("version") == 2,
          f"code={code} resp={updated}")

    # 9. 创建突降规则（高比例，当前值接近基线不命中）
    code, drop_rule = req("POST", "/anomaly-rules", token=token, body={
        "name": "突降检测",
        "condition": {"type": "drop", "metric": "generationKwh", "windowMinutes": 120, "dropRatio": 0.9},
        "severity": "CRITICAL",
    })
    check("创建突降规则", code in (200, 201) and isinstance(drop_rule, dict), f"code={code}")
    drop_rule_id = (drop_rule or {}).get("id")

    # 10. 触发检测（当前 5.0，突降不命中；阈值也不命中 → 无事件）
    code, events = req("POST", "/anomaly/detect", token=token, body={
        "plantId": PLANT_ID, "value": 5.0,
    })
    check("检测未命中返回空", code in (200, 201) and isinstance(events, list) and len(events) == 0,
          f"code={code} events={events}")

    # 11. 触发检测（当前 0.1，突降命中 CRITICAL）
    code, events = req("POST", "/anomaly/detect", token=token, body={
        "plantId": PLANT_ID, "value": 0.1,
    })
    hit_drop = (
        code in (200, 201) and isinstance(events, list) and len(events) > 0
        and any(e.get("ruleId") == drop_rule_id for e in events)
    )
    check("检测命中突降规则", hit_drop, f"code={code} events={events}")

    # 12. 删除规则
    code, _ = req("DELETE", f"/anomaly-rules/{rule_id}", token=token)
    check("删除阈值规则", code == 204, f"code={code}")
    code, _ = req("DELETE", f"/anomaly-rules/{drop_rule_id}", token=token)
    check("删除突降规则", code == 204, f"code={code}")

    # 13. 普通用户无权访问规则端点（RBAC 校验）
    # 此处仅验证 OPERATOR/ADMIN 守卫：用一个无 token 请求应返回 401。
    code, _ = req("GET", "/anomaly-rules")
    check("未登录访问规则端点返回 401", code == 401, f"code={code}")

    finish()


def finish():
    print("-" * 60)
    print(f"通过 {len(PASS)} 项，失败 {len(FAIL)} 项")
    if FAIL:
        print("失败项：")
        for f in FAIL:
            print(f"  - {f}")
        return 1
    print("全部通过！")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
