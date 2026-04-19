from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

RecordType = Literal["diet", "exercise", "health"]
ReportType = Literal["daily", "weekly", "monthly"]


class Message(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    time: str
    quick_actions: list[str] = Field(default_factory=list)


class Profile(BaseModel):
    user_id: str = "demo-user"
    nickname: str = "来福用户"
    gender: str | None = None
    age: int | None = None
    height: float | None = None
    weight: float | None = None
    target_weight: float | None = None
    activity_level: str | None = None
    allergies: list[str] = Field(default_factory=list)
    family_history: list[str] = Field(default_factory=list)
    health_goals: list[str] = Field(default_factory=list)


class ProfileUpdate(BaseModel):
    gender: str | None = None
    age: int | None = None
    height: float | None = None
    weight: float | None = None
    target_weight: float | None = None
    activity_level: str | None = None
    allergies: list[str] = Field(default_factory=list)
    family_history: list[str] = Field(default_factory=list)
    health_goals: list[str] = Field(default_factory=list)


class Record(BaseModel):
    id: str
    user_id: str
    type: RecordType
    subtype: str | None = None
    title: str
    content: dict[str, Any]
    images: list[str] = Field(default_factory=list)
    ai_analysis: dict[str, Any]
    calories: int = 0
    duration: int = 0
    distance: float = 0
    health_metrics: dict[str, Any] = Field(default_factory=dict)
    conversation_id: str | None = None
    recorded_at: str
    created_at: str


class StartConversationResponse(BaseModel):
    conversation_id: str
    message: Message


class RecordMessageRequest(BaseModel):
    user_id: str = "demo-user"
    conversation_id: str | None = None
    text: str = ""
    images: list[str] = Field(default_factory=list)


class RecordMessageResponse(BaseModel):
    conversation_id: str
    messages: list[Message]
    pending_record: dict[str, Any] | None = None


class ConfirmRecordRequest(BaseModel):
    user_id: str = "demo-user"
    conversation_id: str
    pending_record: dict[str, Any]
    confirmed: bool = True
    supplement: str | None = None


class AdvisorMessageRequest(BaseModel):
    user_id: str = "demo-user"
    session_id: str | None = None
    text: str


class AdvisorMessageResponse(BaseModel):
    session_id: str
    messages: list[Message]


class Consultation(BaseModel):
    id: str
    user_id: str
    summary: str
    messages: list[Message]
    created_at: str
    updated_at: str


class Report(BaseModel):
    id: str
    user_id: str
    type: ReportType
    period_start: str
    period_end: str
    score: float
    title: str
    summary: str
    content: dict[str, Any]
    created_at: str


class GenerateReportRequest(BaseModel):
    user_id: str = "demo-user"
    type: ReportType = "daily"


class Dashboard(BaseModel):
    user_id: str
    greeting: str
    today: dict[str, Any]
    stats: dict[str, Any]
    recent_records: list[Record]
    latest_report: Report | None = None
