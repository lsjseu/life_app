# 来福后端

FastAPI MVP 服务，使用 SQLite 存储数据，并用规则化服务模拟统一记录 Agent、健康顾问 Agent 和报告生成 Agent。

## 启动

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## 初始化演示数据

```bash
python -m app.seed
```

## API

- `GET /api/v1/home/dashboard`
- `POST /api/v1/record/conversations`
- `POST /api/v1/record/message`
- `POST /api/v1/record/confirm`
- `GET /api/v1/records`
- `POST /api/v1/advisor/message`
- `GET /api/v1/advisor/sessions`
- `GET /api/v1/reports`
- `POST /api/v1/reports/generate`
- `GET /api/v1/profile`
- `PUT /api/v1/profile`

