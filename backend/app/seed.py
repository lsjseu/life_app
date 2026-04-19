from __future__ import annotations

from .database import init_db
from .services import classify_record, save_record


def main() -> None:
    init_db()
    examples = [
        "我早餐吃了一个包子、一杯豆浆、一个鸡蛋",
        "我今天晚上跑步5公里，用时30分钟",
        "我今天早上量的血压，高压135，低压85，心率72",
    ]
    for text in examples:
        save_record("demo-user", None, classify_record(text))
    print("Seed data created.")


if __name__ == "__main__":
    main()

