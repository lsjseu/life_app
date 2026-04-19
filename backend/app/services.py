from __future__ import annotations

import re
import uuid
from datetime import date, datetime, timedelta
from typing import Any

from .agents.deerflow_health import DeerFlowHealthAgent, HealthAgentResult
from .database import dumps, get_db, loads
from .schemas import Message, Record


def now_text() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def msg(role: str, content: str, quick_actions: list[str] | None = None) -> Message:
    return Message(
        id=str(uuid.uuid4()),
        role=role,  # type: ignore[arg-type]
        content=content,
        time=datetime.now().strftime("%H:%M"),
        quick_actions=quick_actions or [],
    )


def classify_record(text: str, images: list[str] | None = None) -> dict[str, Any]:
    images = images or []
    normalized = text.strip()
    if images and not normalized:
        normalized = "拍照记录"

    health_keywords = ["血压", "高压", "低压", "心率", "血糖", "体重", "体温", "睡眠"]
    exercise_keywords = ["跑步", "快走", "游泳", "瑜伽", "骑行", "训练", "健身", "公里", "分钟"]
    diet_keywords = ["吃", "喝", "早餐", "午餐", "晚餐", "包子", "豆浆", "鸡蛋", "米饭", "苹果", "咖啡"]

    if any(word in normalized for word in health_keywords):
        return _parse_health(normalized, images)
    if any(word in normalized for word in exercise_keywords):
        return _parse_exercise(normalized, images)
    if any(word in normalized for word in diet_keywords) or images:
        return _parse_diet(normalized, images)

    return {
        "type": "health",
        "subtype": "note",
        "title": "健康记录",
        "content": {"description": normalized or "拍照记录"},
        "images": images,
        "calories": 0,
        "duration": 0,
        "distance": 0,
        "health_metrics": {},
        "ai_analysis": {
            "summary": "已记录你的健康补充信息。",
            "suggestion": "建议持续记录，来福会结合趋势给出更准确的建议。",
            "status": "normal",
        },
    }


def _parse_diet(text: str, images: list[str]) -> dict[str, Any]:
    food_calories = {
        "包子": 220,
        "豆浆": 120,
        "鸡蛋": 80,
        "米饭": 220,
        "红烧肉": 360,
        "青菜": 60,
        "苹果": 90,
        "咖啡": 30,
        "粥": 120,
        "汤": 80,
    }
    items = []
    total = 0
    for food, calories in food_calories.items():
        if food in text:
            count = 1
            match = re.search(rf"([一二两三四五六七八九十0-9]+)[个杯碗份]?.{{0,2}}{food}", text)
            if match:
                count = _cn_number(match.group(1))
            items.append({"name": food, "count": count, "calories": calories * count})
            total += calories * count
    if not items and images:
        items = [
            {"name": "米饭", "count": 1, "calories": 220},
            {"name": "蔬菜", "count": 1, "calories": 80},
            {"name": "肉类", "count": 1, "calories": 260},
        ]
        total = 560
    if not items:
        items = [{"name": text or "饮食", "count": 1, "calories": 300}]
        total = 300
    meal_type = "早餐" if "早餐" in text else "午餐" if "午餐" in text or "中午" in text else "晚餐" if "晚餐" in text or "晚上" in text else "加餐"
    return {
        "type": "diet",
        "subtype": meal_type,
        "title": f"{meal_type}记录",
        "content": {"items": items, "raw_text": text},
        "images": images,
        "calories": total,
        "duration": 0,
        "distance": 0,
        "health_metrics": {},
        "ai_analysis": {
            "summary": f"{meal_type}约 {total} 千卡。",
            "suggestion": "搭配蔬菜和优质蛋白会更均衡，注意少油少糖。",
            "status": "normal" if total <= 700 else "warning",
        },
    }


def _parse_exercise(text: str, images: list[str]) -> dict[str, Any]:
    activity = "跑步" if "跑步" in text else "游泳" if "游泳" in text else "瑜伽" if "瑜伽" in text else "运动"
    distance = _first_number(text, r"([0-9]+(?:\.[0-9]+)?)\s*公里") or 0
    duration = int(_first_number(text, r"([0-9]+)\s*分钟") or _first_number(text, r"([0-9]+)\s*小时") * 60 or 30)
    calories = int((distance * 70) if distance else duration * 7)
    return {
        "type": "exercise",
        "subtype": activity,
        "title": f"{activity}记录",
        "content": {"activity": activity, "raw_text": text},
        "images": images,
        "calories": calories,
        "duration": duration,
        "distance": distance,
        "health_metrics": {},
        "ai_analysis": {
            "summary": f"{activity}{duration}分钟，约消耗 {calories} 千卡。",
            "suggestion": "运动后记得补充水分，拉伸放松可以降低肌肉酸痛。",
            "status": "normal",
        },
    }


def _parse_health(text: str, images: list[str]) -> dict[str, Any]:
    metrics: dict[str, Any] = {}
    high = _first_number(text, r"(?:高压|收缩压)[^\d]*(\d+)")
    low = _first_number(text, r"(?:低压|舒张压)[^\d]*(\d+)")
    heart = _first_number(text, r"(?:心率)[^\d]*(\d+)")
    weight = _first_number(text, r"(?:体重)?\s*(\d+(?:\.\d+)?)\s*公斤")
    glucose = _first_number(text, r"(?:血糖)[^\d]*(\d+(?:\.\d+)?)")
    temperature = _first_number(text, r"(?:体温)[^\d]*(\d+(?:\.\d+)?)")
    if high:
        metrics["systolic"] = high
    if low:
        metrics["diastolic"] = low
    if heart:
        metrics["heart_rate"] = heart
    if weight:
        metrics["weight"] = weight
    if glucose:
        metrics["glucose"] = glucose
    if temperature:
        metrics["temperature"] = temperature

    status = "normal"
    if high and high >= 140 or low and low >= 90:
        status = "warning"
    subtype = "血压" if high or low else "体重" if weight else "血糖" if glucose else "健康指标"
    return {
        "type": "health",
        "subtype": subtype,
        "title": f"{subtype}记录",
        "content": {"raw_text": text},
        "images": images,
        "calories": 0,
        "duration": 0,
        "distance": 0,
        "health_metrics": metrics,
        "ai_analysis": {
            "summary": f"已记录{subtype}，当前状态{'需关注' if status == 'warning' else '平稳'}。",
            "suggestion": "建议在相同时间、相同状态下持续测量，便于观察趋势。",
            "status": status,
        },
    }


def _first_number(text: str, pattern: str) -> float:
    match = re.search(pattern, text)
    return float(match.group(1)) if match else 0


def _cn_number(text: str) -> int:
    mapping = {"一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}
    if text.isdigit():
        return int(text)
    return mapping.get(text, 1)


def confirmation_text(pending: dict[str, Any]) -> str:
    record_type = {"diet": "饮食", "exercise": "运动", "health": "健康"}.get(pending["type"], "健康")
    lines = [f"已识别到{record_type}记录："]
    if pending["type"] == "diet":
        for item in pending["content"].get("items", []):
            lines.append(f"• {item['name']} x{item['count']}")
    elif pending["type"] == "exercise":
        lines.append(f"• 运动类型：{pending['subtype']}")
        if pending.get("distance"):
            lines.append(f"• 距离：{pending['distance']}公里")
        lines.append(f"• 时长：{pending['duration']}分钟")
    else:
        for key, value in pending.get("health_metrics", {}).items():
            label = {"systolic": "收缩压", "diastolic": "舒张压", "heart_rate": "心率", "weight": "体重", "glucose": "血糖", "temperature": "体温"}.get(key, key)
            lines.append(f"• {label}：{value}")
        if len(lines) == 1:
            lines.append(f"• {pending['content'].get('raw_text', '健康补充')}")
    lines.append("对吗？")
    return "\n".join(lines)


def save_record(user_id: str, conversation_id: str | None, pending: dict[str, Any]) -> Record:
    record_id = str(uuid.uuid4())
    current = now_text()
    with get_db() as db:
        db.execute(
            """
            INSERT INTO records (
                id, user_id, type, subtype, title, content, images, ai_analysis,
                calories, duration, distance, health_metrics, conversation_id, recorded_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record_id,
                user_id,
                pending["type"],
                pending.get("subtype"),
                pending["title"],
                dumps(pending["content"]),
                dumps(pending.get("images", [])),
                dumps(pending["ai_analysis"]),
                pending.get("calories", 0),
                pending.get("duration", 0),
                pending.get("distance", 0),
                dumps(pending.get("health_metrics", {})),
                conversation_id,
                current,
                current,
                current,
            ),
        )
    return get_record(record_id)


def row_to_record(row: Any) -> Record:
    return Record(
        id=row["id"],
        user_id=row["user_id"],
        type=row["type"],
        subtype=row["subtype"],
        title=row["title"],
        content=loads(row["content"], {}),
        images=loads(row["images"], []),
        ai_analysis=loads(row["ai_analysis"], {}),
        calories=row["calories"] or 0,
        duration=row["duration"] or 0,
        distance=row["distance"] or 0,
        health_metrics=loads(row["health_metrics"], {}),
        conversation_id=row["conversation_id"],
        recorded_at=row["recorded_at"],
        created_at=row["created_at"],
    )


def get_record(record_id: str) -> Record:
    with get_db() as db:
        row = db.execute("SELECT * FROM records WHERE id = ?", (record_id,)).fetchone()
    if row is None:
        raise KeyError(record_id)
    return row_to_record(row)


def list_records(user_id: str = "demo-user", record_type: str | None = None, limit: int = 20) -> list[Record]:
    with get_db() as db:
        if record_type:
            rows = db.execute(
                "SELECT * FROM records WHERE user_id = ? AND type = ? ORDER BY recorded_at DESC LIMIT ?",
                (user_id, record_type, limit),
            ).fetchall()
        else:
            rows = db.execute(
                "SELECT * FROM records WHERE user_id = ? ORDER BY recorded_at DESC LIMIT ?",
                (user_id, limit),
            ).fetchall()
    return [row_to_record(row) for row in rows]


def get_profile_snapshot(user_id: str = "demo-user") -> dict[str, Any]:
    with get_db() as db:
        row = db.execute("SELECT * FROM profiles WHERE user_id = ?", (user_id,)).fetchone()
    if row is None:
        return {}
    return {
        "gender": row["gender"],
        "age": row["age"],
        "height": row["height"],
        "weight": row["weight"],
        "target_weight": row["target_weight"],
        "activity_level": row["activity_level"],
        "allergies": loads(row["allergies"], []),
        "family_history": loads(row["family_history"], []),
        "health_goals": loads(row["health_goals"], []),
    }


def advisor_agent_reply(user_id: str, text: str, records: list[Record] | None = None) -> HealthAgentResult:
    agent = DeerFlowHealthAgent()
    return agent.run(
        user_id=user_id,
        question=text,
        profile=get_profile_snapshot(user_id),
        records=records if records is not None else list_records(user_id, limit=20),
    )


def advisor_reply(text: str, records: list[Record]) -> str:
    if "血糖" in text:
        return "血糖偏高时，建议优先控制精制碳水和含糖饮料，主食选择全谷物，并保持规律运动。若连续多次异常，请及时咨询医生。"
    if "血压" in text:
        return "血压管理要关注低盐饮食、规律作息和持续测量。最近如果有头晕、胸闷等不适，建议尽快就医。"
    if "饮食" in text or "吃" in text:
        return "饮食上建议每餐包含优质蛋白、蔬菜和适量主食。你可以继续用来福记录三餐，我会结合趋势给出更具体建议。"
    if records:
        return f"我看到了你最近有 {len(records)} 条健康记录。整体建议是继续保持记录频率，优先关注饮食均衡、运动持续性和关键指标变化。"
    return "我可以帮你解读饮食、运动、血压、血糖、体重等问题。先记录几天数据后，建议会更贴合你的实际情况。"


def generate_report_payload(report_type: str, records: list[Record]) -> dict[str, Any]:
    calories_in = sum(r.calories for r in records if r.type == "diet")
    calories_out = sum(r.calories for r in records if r.type == "exercise")
    exercise_minutes = sum(r.duration for r in records if r.type == "exercise")
    health_count = len([r for r in records if r.type == "health"])
    score = min(98, 72 + len(records) * 2 + min(10, exercise_minutes // 30))
    return {
        "score": float(score),
        "summary": "本周期记录持续性良好，饮食、运动和健康指标已形成初步趋势。" if records else "本周期记录较少，建议先连续记录一周。",
        "sections": [
            {"title": "记录概览", "items": [f"共记录 {len(records)} 条", f"健康指标记录 {health_count} 条"]},
            {"title": "饮食分析", "items": [f"饮食摄入约 {calories_in} 千卡", "建议保证蔬菜和优质蛋白摄入"]},
            {"title": "运动分析", "items": [f"运动消耗约 {calories_out} 千卡", f"累计运动 {exercise_minutes} 分钟"]},
            {"title": "来福建议", "items": ["保持每日记录", "每周至少 3 次中等强度运动", "异常指标请及时咨询医生"]},
        ],
        "type": report_type,
    }


def period_for(report_type: str) -> tuple[str, str]:
    today = date.today()
    if report_type == "monthly":
        start = today.replace(day=1)
    else:
        start = today - timedelta(days=today.weekday())
    return start.isoformat(), today.isoformat()
