# 来福 Life App

基于 `docs/` 设计文档实现的来福健康管理 MVP，包含微信小程序端与 FastAPI 后端。

## 目录

- `app/`：React Native / Expo App
- `miniprogram/`：微信小程序原生 TypeScript 端
- `backend/`：FastAPI 后端，内置 SQLite 与规则化 AI 模拟
- `docs/`：产品、UI、前后端技术方案文档

## 后端启动

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

接口文档：`http://127.0.0.1:8000/docs`

## Linux 部署

部署脚本在 `scripts/deploy_linux.sh`，会同步项目、安装后端依赖、自动创建数据库表，并启动 FastAPI 后端：

```bash
bash scripts/deploy_linux.sh
```

默认数据库配置参考 SmartTrader：

```text
DB_TYPE=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=admin
DB_NAME=life_app
```

如果需要用 root 管理员账号创建业务用户和授权，可以这样运行：

```bash
MYSQL_ADMIN_USER=root MYSQL_ADMIN_PASSWORD='你的root密码' bash scripts/deploy_linux.sh
```

建表脚本：

[scripts/mysql_schema.sql](/Users/bytedance/code/life_app/scripts/mysql_schema.sql)

## 小程序端

使用微信开发者工具打开 `miniprogram/` 目录。

默认 API 地址配置在 `miniprogram/constants/config.ts`，本地为：

```text
http://127.0.0.1:8000/api/v1
```

## React Native App

App 代码在 `app/` 目录，使用 Expo 管理：

```bash
cd app
npm install
npm run start
```

默认 API 地址为：

```text
http://127.0.0.1:8000/api/v1
```

如果用真机调试，`127.0.0.1` 会指向手机自身，需要复制 `.env.example` 为 `.env`，并把 `EXPO_PUBLIC_API_BASE_URL` 改成电脑局域网 IP，例如：

```text
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.8:8000/api/v1
```

## MVP 功能

- React Native App：首页、报告、顾问、我的、统一记录弹层
- 首页今日健康概览
- 统一记录对话浮层，支持文字/语音占位/拍照占位
- AI 自动识别饮食、运动、健康记录
- 报告页周报/月报展示与手动生成
- 顾问页 AI 健康咨询与咨询记录
- 我的页健康档案、历史趋势、记录列表
