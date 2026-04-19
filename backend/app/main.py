from __future__ import annotations

import uuid

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .database import dumps, get_db, init_db, loads
from .schemas import (
    AdvisorMessageRequest,
    AdvisorMessageResponse,
    ConfirmRecordRequest,
    Consultation,
    Dashboard,
    GenerateReportRequest,
    Profile,
    ProfileUpdate,
    Record,
    RecordMessageRequest,
    RecordMessageResponse,
    Report,
    StartConversationResponse,
)
from .services import (
    advisor_agent_reply,
    advisor_llm_status,
    classify_record,
    confirmation_text,
    generate_report_payload,
    list_records,
    msg,
    period_for,
    save_record,
)

app = FastAPI(title="来福 Life API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/")
def root() -> dict[str, str]:
    return {"name": "来福 Life API", "status": "ok"}


@app.get("/api/v1/home/dashboard", response_model=Dashboard)
def home_dashboard(user_id: str = "demo-user") -> Dashboard:
    records = list_records(user_id=user_id, limit=5)
    latest_report = _latest_report(user_id)
    diet_calories = sum(r.calories for r in records if r.type == "diet")
    exercise_calories = sum(r.calories for r in records if r.type == "exercise")
    health_records = [r for r in records if r.type == "health"]
    return Dashboard(
        user_id=user_id,
        greeting="今天也和来福一起，好好照顾自己",
        today={
            "diet_calories": diet_calories,
            "exercise_calories": exercise_calories,
            "health_count": len(health_records),
            "water_cups": 5,
        },
        stats={
            "record_days": 14 if records else 0,
            "total_records": len(list_records(user_id=user_id, limit=1000)),
            "health_score": latest_report.score if latest_report else 82,
        },
        recent_records=records,
        latest_report=latest_report,
    )


@app.get("/api/v1/profile", response_model=Profile)
def get_profile(user_id: str = "demo-user") -> Profile:
    with get_db() as db:
        row = db.execute(
            """
            SELECT u.id, u.nickname, p.* FROM users u
            LEFT JOIN profiles p ON p.user_id = u.id
            WHERE u.id = ?
            """,
            (user_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    return Profile(
        user_id=row["id"],
        nickname=row["nickname"],
        gender=row["gender"],
        age=row["age"],
        height=row["height"],
        weight=row["weight"],
        target_weight=row["target_weight"],
        activity_level=row["activity_level"],
        allergies=loads(row["allergies"], []),
        family_history=loads(row["family_history"], []),
        health_goals=loads(row["health_goals"], []),
    )


@app.put("/api/v1/profile", response_model=Profile)
def update_profile(payload: ProfileUpdate, user_id: str = "demo-user") -> Profile:
    with get_db() as db:
        db.execute(
            """
            INSERT INTO profiles (
                user_id, gender, age, height, weight, target_weight, activity_level,
                allergies, family_history, health_goals, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                gender = excluded.gender,
                age = excluded.age,
                height = excluded.height,
                weight = excluded.weight,
                target_weight = excluded.target_weight,
                activity_level = excluded.activity_level,
                allergies = excluded.allergies,
                family_history = excluded.family_history,
                health_goals = excluded.health_goals,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                user_id,
                payload.gender,
                payload.age,
                payload.height,
                payload.weight,
                payload.target_weight,
                payload.activity_level,
                dumps(payload.allergies),
                dumps(payload.family_history),
                dumps(payload.health_goals),
            ),
        )
    return get_profile(user_id)


@app.post("/api/v1/record/conversations", response_model=StartConversationResponse)
def start_record_conversation() -> StartConversationResponse:
    return StartConversationResponse(
        conversation_id=str(uuid.uuid4()),
        message=msg("assistant", "你好！想记录点什么？可以说话、拍照或打字告诉我", ["我吃了...", "我运动了...", "我量了..."]),
    )


@app.post("/api/v1/record/message", response_model=RecordMessageResponse)
def send_record_message(payload: RecordMessageRequest) -> RecordMessageResponse:
    conversation_id = payload.conversation_id or str(uuid.uuid4())
    user_message = msg("user", payload.text or "发送了图片")
    pending = classify_record(payload.text, payload.images)
    assistant_message = msg("assistant", confirmation_text(pending), ["保存记录", "重新填写", "补充"])
    return RecordMessageResponse(
        conversation_id=conversation_id,
        messages=[user_message, assistant_message],
        pending_record=pending,
    )


@app.post("/api/v1/record/confirm", response_model=RecordMessageResponse)
def confirm_record(payload: ConfirmRecordRequest) -> RecordMessageResponse:
    if not payload.confirmed:
        return RecordMessageResponse(
            conversation_id=payload.conversation_id,
            messages=[msg("assistant", "没关系，哪里不对？你可以直接补充或重新描述。", ["重新填写", "补充"])],
            pending_record=payload.pending_record,
        )
    pending = payload.pending_record
    if payload.supplement:
        pending["content"]["supplement"] = payload.supplement
        pending["ai_analysis"]["summary"] += f" 已补充：{payload.supplement}"
    record = save_record(payload.user_id, payload.conversation_id, pending)
    content = (
        f"好的，已保存：{record.title}。\n"
        f"{record.ai_analysis.get('summary', '')}\n"
        f"{record.ai_analysis.get('suggestion', '')}\n"
        "还需要记录什么吗？"
    )
    return RecordMessageResponse(
        conversation_id=payload.conversation_id,
        messages=[msg("user", "保存记录"), msg("assistant", content, ["继续记录", "完成"])],
        pending_record=None,
    )


@app.get("/api/v1/records", response_model=list[Record])
def get_records(
    user_id: str = "demo-user",
    type: str | None = Query(default=None, description="diet/exercise/health"),
    limit: int = 50,
) -> list[Record]:
    return list_records(user_id=user_id, record_type=type, limit=limit)


@app.get("/api/v1/records/{record_id}", response_model=Record)
def get_record_detail(record_id: str) -> Record:
    try:
        from .services import get_record

        return get_record(record_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Record not found") from None


@app.delete("/api/v1/records/{record_id}")
def delete_record(record_id: str) -> dict[str, bool]:
    with get_db() as db:
        db.execute("DELETE FROM records WHERE id = ?", (record_id,))
    return {"ok": True}


@app.post("/api/v1/advisor/message", response_model=AdvisorMessageResponse)
def send_advisor_message(payload: AdvisorMessageRequest) -> AdvisorMessageResponse:
    session_id = payload.session_id or str(uuid.uuid4())
    with get_db() as db:
        row = db.execute("SELECT * FROM consultations WHERE id = ?", (session_id,)).fetchone()
    messages = loads(row["messages"], []) if row else []
    user_message = msg("user", payload.text)
    agent_result = advisor_agent_reply(payload.user_id, payload.text, list_records(payload.user_id, limit=20))
    assistant_message = msg("assistant", agent_result.content, agent_result.quick_actions)
    messages.extend([user_message.model_dump(), assistant_message.model_dump()])
    summary = payload.text[:40] or "健康咨询"
    with get_db() as db:
        db.execute(
            """
            INSERT INTO consultations (id, user_id, summary, messages, created_at, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                summary = excluded.summary,
                messages = excluded.messages,
                updated_at = CURRENT_TIMESTAMP
            """,
            (session_id, payload.user_id, summary, dumps(messages)),
        )
    return AdvisorMessageResponse(
        session_id=session_id,
        messages=[user_message, assistant_message],
    )


@app.get("/api/v1/advisor/llm/status")
def get_advisor_llm_status() -> dict[str, object]:
    return advisor_llm_status()


@app.get("/api/v1/advisor/sessions", response_model=list[Consultation])
def list_advisor_sessions(user_id: str = "demo-user") -> list[Consultation]:
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM consultations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50",
            (user_id,),
        ).fetchall()
    return [
        Consultation(
            id=row["id"],
            user_id=row["user_id"],
            summary=row["summary"],
            messages=loads(row["messages"], []),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
        for row in rows
    ]


@app.get("/api/v1/reports", response_model=list[Report])
def list_reports(user_id: str = "demo-user") -> list[Report]:
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM reports WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
            (user_id,),
        ).fetchall()
    reports = [_row_to_report(row) for row in rows]
    if reports:
        return reports
    return [create_report(user_id, "daily")]


@app.post("/api/v1/reports/generate", response_model=Report)
def generate_report(payload: GenerateReportRequest) -> Report:
    return create_report(payload.user_id, payload.type)


@app.get("/api/v1/reports/{report_id}", response_model=Report)
def get_report(report_id: str) -> Report:
    with get_db() as db:
        row = db.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return _row_to_report(row)


def create_report(user_id: str, report_type: str) -> Report:
    report_id = str(uuid.uuid4())
    start, end = period_for(report_type)
    payload = generate_report_payload(report_type, list_records(user_id=user_id, limit=200))
    title_map = {
        "daily": "来福健康日报",
        "weekly": "来福健康周报",
        "monthly": "来福健康月报",
    }
    title = title_map.get(report_type, "来福健康报告")
    with get_db() as db:
        db.execute(
            """
            INSERT INTO reports (
                id, user_id, type, period_start, period_end, score, title, summary, content, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (
                report_id,
                user_id,
                report_type,
                start,
                end,
                payload["score"],
                title,
                payload["summary"],
                dumps(payload),
            ),
        )
        row = db.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
    return _row_to_report(row)


def _latest_report(user_id: str) -> Report | None:
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM reports WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
            (user_id,),
        ).fetchone()
    return _row_to_report(row) if row else None


def _row_to_report(row) -> Report:
    return Report(
        id=row["id"],
        user_id=row["user_id"],
        type=row["type"],
        period_start=row["period_start"],
        period_end=row["period_end"],
        score=row["score"],
        title=row["title"],
        summary=row["summary"],
        content=loads(row["content"], {}),
        created_at=row["created_at"],
    )
