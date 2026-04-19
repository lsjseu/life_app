# Script Directory

本目录存放来福 `life_app` 的部署、配置和初始化脚本文件。

## 文件说明

- `deploy_linux.sh`
  - Linux/OpenCloudOS 用户态部署脚本。
  - 负责准备运行目录、同步代码、安装后端依赖、初始化数据库并启动 FastAPI 后端。
  - 默认日志写入项目根目录下的 `log/`，部署同步时会自动排除该目录。

- `life_app.conf`
  - 脚本统一配置文件，格式是简单的 `KEY=VALUE`。
  - 后端端口、Python、SQLite/MySQL 开关、MySQL 账号、日志目录等默认值都在这里维护。
  - 所有配置仍支持通过环境变量临时覆盖。

- `load_life_app_config.sh`
  - 配置读取工具脚本，一般不需要修改。

- `mysql_schema.sql`
  - 来福 MySQL 建库建表 SQL 模板。
  - 部署时会由 `deploy_linux.sh` 按配置替换占位符后执行。

- `crontab.life_app`
  - 定时任务模板。
  - 当前包含服务健康检查和 demo 用户周报生成任务。

## 使用方式

在项目根目录执行：

```bash
bash scripts/deploy_linux.sh
```

通用配置优先维护在 `scripts/life_app.conf`。临时覆盖某个配置时，可以在命令前传环境变量：

```bash
BACKEND_PORT=8010 LOG_DIR=/deploy/life_app/log bash scripts/deploy_linux.sh
```

如果需要使用管理员账号创建 MySQL 数据库和授权：

```bash
MYSQL_ADMIN_HOST=127.0.0.1 \
MYSQL_ADMIN_PORT=3306 \
MYSQL_ADMIN_USER=root \
MYSQL_ADMIN_PASSWORD='你的密码' \
bash scripts/deploy_linux.sh
```

