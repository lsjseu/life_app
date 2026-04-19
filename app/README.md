# 来福 React Native App

这是来福的 React Native / Expo 移动端 MVP，复用项目里的 FastAPI 后端。

## 启动前准备

先启动后端：

```bash
cd ../backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## 启动 App

```bash
cd ../app
npm install
npm run start
```

然后在 Expo 里选择 iOS Simulator、Android Emulator 或 Expo Go。

## 真机调试 API 地址

默认配置：

```text
http://127.0.0.1:8000/api/v1
```

真机访问电脑后端时，请创建 `.env`：

```bash
cp .env.example .env
```

将地址改成电脑局域网 IP：

```text
EXPO_PUBLIC_API_BASE_URL=http://你的电脑IP:8000/api/v1
```

## 已实现

- 首页：健康评分、今日数据、最近记录、统一记录入口
- 统一记录弹层：自然语言记录、AI确认、保存记录
- 报告：周报/月报生成、最新报告、历史报告
- 顾问：AI健康对话、快捷问题、咨询记录
- 我的：健康档案、记录统计、健康目标、档案管理入口

