from __future__ import annotations

import re
from dataclasses import dataclass, field
from statistics import mean
from typing import Any, Literal

from ..schemas import Record

Intent = Literal[
    "blood_pressure",
    "glucose",
    "weight",
    "diet",
    "exercise",
    "sleep",
    "symptom",
    "general",
]


@dataclass
class HealthAgentResult:
    content: str
    quick_actions: list[str] = field(default_factory=list)
    trace: list[str] = field(default_factory=list)
    risk_level: Literal["normal", "attention", "urgent"] = "normal"


@dataclass
class HealthAgentState:
    user_id: str
    question: str
    profile: dict[str, Any]
    records: list[Record]
    intent: Intent = "general"
    plan: list[str] = field(default_factory=list)
    findings: list[str] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)
    quick_actions: list[str] = field(default_factory=list)
    trace: list[str] = field(default_factory=list)
    risk_level: Literal["normal", "attention", "urgent"] = "normal"
    urgent_reason: str | None = None


class DeerFlowHealthAgent:
    """A lightweight DeerFlow-style health consultation agent.

    The structure mirrors DeerFlow's coordinator -> planner -> specialist
    workers -> reporter flow, but keeps runtime local and dependency-light for
    the current FastAPI MVP.
    """

    def run(self, user_id: str, question: str, profile: dict[str, Any], records: list[Record]) -> HealthAgentResult:
        state = HealthAgentState(user_id=user_id, question=question.strip(), profile=profile, records=records)
        self._coordinate(state)
        self._plan(state)
        self._triage_safety(state)
        if state.risk_level != "urgent":
            self._research_profile(state)
            self._research_records(state)
            self._coach(state)
        return self._report(state)

    def _coordinate(self, state: HealthAgentState) -> None:
        text = state.question
        state.trace.append("Coordinator: 接收问题并识别咨询意图")
        if any(word in text for word in ["血压", "高压", "低压", "头晕", "胸闷"]):
            state.intent = "blood_pressure"
        elif any(word in text for word in ["血糖", "空腹", "餐后", "糖尿病"]):
            state.intent = "glucose"
        elif any(word in text for word in ["体重", "减肥", "增肌", "BMI", "bmi"]):
            state.intent = "weight"
        elif any(word in text for word in ["吃", "饮食", "早餐", "午餐", "晚餐", "热量", "蛋白"]):
            state.intent = "diet"
        elif any(word in text for word in ["运动", "跑步", "快走", "训练", "游泳", "瑜伽"]):
            state.intent = "exercise"
        elif any(word in text for word in ["睡", "失眠", "熬夜", "入睡", "早醒"]):
            state.intent = "sleep"
        elif any(word in text for word in ["疼", "痛", "发烧", "咳嗽", "不舒服", "恶心"]):
            state.intent = "symptom"
        else:
            state.intent = "general"

    def _plan(self, state: HealthAgentState) -> None:
        state.trace.append("Planner: 拆解为安全判断、档案检索、记录分析、建议生成")
        state.plan = [
            "先识别是否存在急症风险",
            "结合用户档案判断基础风险因素",
            "读取最近记录寻找趋势和异常值",
            "给出生活方式建议和下一步记录动作",
        ]

    def _triage_safety(self, state: HealthAgentState) -> None:
        state.trace.append("SafetyTriage: 执行健康安全分诊")
        text = state.question
        urgent_keywords = [
            "胸痛",
            "胸闷喘不过气",
            "呼吸困难",
            "意识不清",
            "昏迷",
            "口角歪斜",
            "一侧无力",
            "大出血",
            "剧烈头痛",
        ]
        if any(word in text for word in urgent_keywords):
            state.risk_level = "urgent"
            state.urgent_reason = "你描述的症状可能存在急症风险"
            return

        systolic = _number_after(text, ["高压", "收缩压"])
        diastolic = _number_after(text, ["低压", "舒张压"])
        glucose = _number_after(text, ["血糖"])
        temperature = _number_after(text, ["体温"])
        if systolic >= 180 or diastolic >= 120:
            state.risk_level = "urgent"
            state.urgent_reason = "血压数值达到需要尽快就医评估的范围"
        elif glucose >= 16.7:
            state.risk_level = "urgent"
            state.urgent_reason = "血糖数值明显偏高，建议尽快联系医生"
        elif temperature >= 39.5:
            state.risk_level = "attention"
            state.findings.append("体温较高，若伴随精神差、呼吸急促或持续不退，需要及时就医。")

    def _research_profile(self, state: HealthAgentState) -> None:
        state.trace.append("ProfileResearcher: 读取用户年龄、体重、目标和风险标签")
        profile = state.profile
        age = profile.get("age")
        weight = profile.get("weight")
        height = profile.get("height")
        goals = profile.get("health_goals") or []
        if age:
            state.findings.append(f"你的档案年龄为 {age} 岁，建议把年龄因素纳入健康目标管理。")
        if height and weight:
            bmi = weight / ((height / 100) ** 2)
            state.findings.append(f"按当前身高体重估算 BMI 约 {bmi:.1f}。")
        if goals:
            state.findings.append(f"你当前健康目标包括：{'、'.join(goals[:3])}。")

    def _research_records(self, state: HealthAgentState) -> None:
        state.trace.append("RecordResearcher: 汇总最近健康、饮食和运动记录")
        records = state.records
        if not records:
            state.findings.append("目前可参考的历史记录还比较少，建议先连续记录 3-7 天。")
            return

        diet_calories = sum(record.calories for record in records if record.type == "diet")
        exercise_minutes = sum(record.duration for record in records if record.type == "exercise")
        health_records = [record for record in records if record.type == "health"]
        state.findings.append(f"我参考了你最近 {len(records)} 条记录，其中健康指标 {len(health_records)} 条。")
        if diet_calories:
            state.findings.append(f"近期饮食记录累计约 {diet_calories} 千卡。")
        if exercise_minutes:
            state.findings.append(f"近期运动累计约 {exercise_minutes} 分钟。")

        systolic_values = _metric_values(health_records, "systolic")
        diastolic_values = _metric_values(health_records, "diastolic")
        glucose_values = _metric_values(health_records, "glucose")
        weight_values = _metric_values(health_records, "weight")
        if state.intent == "blood_pressure" and systolic_values:
            state.findings.append(f"最近收缩压均值约 {mean(systolic_values):.0f}，最高 {max(systolic_values):.0f}。")
        if state.intent == "blood_pressure" and diastolic_values:
            state.findings.append(f"最近舒张压均值约 {mean(diastolic_values):.0f}，最高 {max(diastolic_values):.0f}。")
        if state.intent == "glucose" and glucose_values:
            state.findings.append(f"最近血糖均值约 {mean(glucose_values):.1f}，最高 {max(glucose_values):.1f}。")
        if state.intent == "weight" and weight_values:
            state.findings.append(f"最近体重记录范围为 {min(weight_values):.1f}-{max(weight_values):.1f} 公斤。")

    def _coach(self, state: HealthAgentState) -> None:
        state.trace.append("HealthCoach: 生成个性化建议和追问")
        if state.intent == "blood_pressure":
            state.recommendations = [
                "先确认测量方式：静坐 5 分钟后测量，袖带位置与心脏同高，连续测 2 次取平均。",
                "饮食上优先控盐，少吃腌制、外卖和重口味食物；同时保证睡眠和规律运动。",
                "如果多次高于 140/90，或伴随头晕、胸闷、胸痛，请尽快咨询医生。",
            ]
            state.quick_actions = ["记录血压", "生成周报", "问饮食建议"]
        elif state.intent == "glucose":
            state.recommendations = [
                "先区分空腹、餐后 2 小时或随机血糖，不同场景参考范围不同。",
                "减少含糖饮料和精制主食，把主食换成全谷物并搭配蛋白质和蔬菜。",
                "如果连续异常，建议带上记录给医生评估，不要自行调整药物。",
            ]
            state.quick_actions = ["记录血糖", "问早餐搭配", "查看报告"]
        elif state.intent == "diet":
            state.recommendations = [
                "每餐按“半盘蔬菜、四分之一蛋白、四分之一主食”的比例先做基础调整。",
                "如果目标是控重，先减少含糖饮料、油炸和夜宵，比一上来极端节食更稳。",
                "你可以继续记录三餐，我会结合热量和频率帮你看趋势。",
            ]
            state.quick_actions = ["记录饮食", "问减脂餐", "生成周报"]
        elif state.intent == "exercise":
            state.recommendations = [
                "建议每周至少 150 分钟中等强度有氧运动，再搭配 2 次力量训练。",
                "如果刚开始恢复运动，先从快走、骑行或低冲击训练开始，逐步增加强度。",
                "运动后记录时长、强度和身体感受，方便我帮你调整计划。",
            ]
            state.quick_actions = ["记录运动", "问运动计划", "查看报告"]
        elif state.intent == "sleep":
            state.recommendations = [
                "先固定起床时间，睡前 1 小时减少手机和高强度工作刺激。",
                "下午后少喝咖啡和浓茶；如果夜间频繁醒来，记录入睡时间和醒来次数。",
                "若失眠持续 2 周以上并影响白天状态，建议咨询医生或心理睡眠门诊。",
            ]
            state.quick_actions = ["记录睡眠", "问放松方法", "查看健康建议"]
        elif state.intent == "symptom":
            state.recommendations = [
                "请补充症状持续多久、严重程度、是否发热，以及有没有用药或基础病。",
                "如果症状突然加重、持续不缓解，或影响呼吸、意识、活动能力，请及时就医。",
                "我可以帮你整理就医前需要记录的信息，但不能替代医生诊断。",
            ]
            state.quick_actions = ["补充症状", "记录体温", "问就医准备"]
        else:
            state.recommendations = [
                "我可以结合你的饮食、运动、血压、血糖、体重和睡眠记录给建议。",
                "当前更适合先建立连续记录，再根据趋势调整目标。",
                "如果你有明确不适、体检异常或用药问题，请告诉我具体数值和时间。",
            ]
            state.quick_actions = ["记录健康指标", "问饮食建议", "生成周报"]

    def _report(self, state: HealthAgentState) -> HealthAgentResult:
        state.trace.append("Reporter: 汇总为用户可读的咨询回复")
        if state.risk_level == "urgent":
            content = (
                f"{state.urgent_reason}。\n\n"
                "建议你现在优先联系当地急救或尽快到医院就诊，尤其是症状正在加重、伴随胸痛/呼吸困难/意识异常时。\n\n"
                "我可以继续帮你整理症状发生时间、测量数值和用药情况，方便就医时说明。"
            )
            return HealthAgentResult(
                content=content,
                quick_actions=["整理就医信息", "记录当前症状"],
                trace=state.trace,
                risk_level=state.risk_level,
            )

        sections = ["我按健康顾问流程帮你看了一下："]
        if state.findings:
            sections.append("\n参考信息：\n" + "\n".join(f"{index}. {item}" for index, item in enumerate(state.findings[:4], 1)))
        if state.recommendations:
            sections.append("\n建议你先这样做：\n" + "\n".join(f"{index}. {item}" for index, item in enumerate(state.recommendations, 1)))
        sections.append("\n提醒：以上是健康管理建议，不能替代医生诊断；如果有明显不适或指标持续异常，请及时就医。")
        return HealthAgentResult(
            content="\n".join(sections),
            quick_actions=state.quick_actions,
            trace=state.trace,
            risk_level=state.risk_level,
        )


def _number_after(text: str, labels: list[str]) -> float:
    for label in labels:
        match = re.search(rf"{label}[^\d]*(\d+(?:\.\d+)?)", text)
        if match:
            return float(match.group(1))
    return 0


def _metric_values(records: list[Record], key: str) -> list[float]:
    values = []
    for record in records:
        value = record.health_metrics.get(key)
        if isinstance(value, int | float):
            values.append(float(value))
    return values

