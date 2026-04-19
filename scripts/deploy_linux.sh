#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/load_life_app_config.sh"
load_life_app_config "$SCRIPT_DIR"

APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"

APP_NAME="${APP_NAME:-life_app}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/share/${APP_NAME}}"
RUNTIME_DIR="${RUNTIME_DIR:-$HOME/.local/state/${APP_NAME}}"
LOG_DIR="${LOG_DIR:-${LINUX_LOG_DIR:-$INSTALL_DIR/log}}"
PID_DIR="${PID_DIR:-$RUNTIME_DIR/pids}"

PYTHON_BIN="${PYTHON_BIN:-python3}"
BACKEND_HOST="${BACKEND_HOST:-${LINUX_BACKEND_HOST:-0.0.0.0}}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
BACKEND_PID_FILE="${BACKEND_PID_FILE:-$PID_DIR/backend.pid}"
BACKEND_LOG_FILE="${BACKEND_LOG_FILE:-$LOG_DIR/life_app_backend.log}"
USE_SQLITE="${USE_SQLITE:-${LINUX_USE_SQLITE:-0}}"

# Defaults follow SmartTrader's database account style.
DB_TYPE="${DB_TYPE:-mysql}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-admin}"
DB_PASSWORD="${DB_PASSWORD:-admin}"
DB_NAME="${DB_NAME:-life_app}"
DB_CHARSET="${DB_CHARSET:-utf8mb4}"

MYSQL_PROVISION="${MYSQL_PROVISION:-1}"
MYSQL_ADMIN_HOST="${MYSQL_ADMIN_HOST:-}"
MYSQL_ADMIN_PORT="${MYSQL_ADMIN_PORT:-}"
MYSQL_ADMIN_USER="${MYSQL_ADMIN_USER:-}"
MYSQL_ADMIN_PASSWORD="${MYSQL_ADMIN_PASSWORD:-}"
SQL_SCHEMA_FILE_RELATIVE="${SQL_SCHEMA_FILE_RELATIVE:-scripts/mysql_schema.sql}"

FORCE_INSTALL="${FORCE_INSTALL:-0}"
STARTUP_TIMEOUT="${STARTUP_TIMEOUT:-60}"
apply_life_app_runtime_config

log() {
  printf '\n[%s] %s\n' "$(date '+%F %T')" "$1"
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

require_cmd() {
  local cmd="$1"
  local hint="$2"
  if ! need_cmd "$cmd"; then
    echo "缺少依赖: $cmd。$hint" >&2
    exit 1
  fi
}

ensure_not_root() {
  if [ "$(id -u)" -eq 0 ]; then
    echo "请不要使用 root 或 sudo 运行此脚本，请切换到普通用户后再执行。" >&2
    exit 1
  fi
}

check_dependencies() {
  log "检查 Linux 部署依赖"
  require_cmd "$PYTHON_BIN" "请先安装 Python 3.10+。"
  require_cmd rsync "请先安装 rsync。"
  require_cmd curl "请先安装 curl。"
}

prepare_dirs() {
  log "准备部署目录"
  mkdir -p "$INSTALL_DIR" "$RUNTIME_DIR" "$PID_DIR" "$LOG_DIR"
}

sync_project() {
  log "同步项目代码到 $INSTALL_DIR"
  rsync -a --delete \
    --exclude ".git" \
    --exclude ".DS_Store" \
    --exclude "log" \
    --exclude "backend/.venv" \
    --exclude "backend/data" \
    --exclude "backend/app/__pycache__" \
    --exclude "app/node_modules" \
    --exclude "app/.expo" \
    --exclude "miniprogram/node_modules" \
    "$APP_DIR/" "$INSTALL_DIR/"
}

install_backend_deps() {
  log "安装后端 Python 依赖"
  cd "$INSTALL_DIR/backend"
  if [ ! -d .venv ]; then
    "$PYTHON_BIN" -m venv .venv
  fi
  .venv/bin/python -m pip install --upgrade pip
  if [ "$FORCE_INSTALL" = "1" ] || [ ! -f .venv/.life_app_deps_installed ]; then
    .venv/bin/pip install -r requirements.txt
    date '+%F %T' > .venv/.life_app_deps_installed
  else
    log "后端依赖已安装，跳过 pip install；如需强制安装请设置 FORCE_INSTALL=1"
  fi
}

write_runtime_env() {
  log "写入后端运行环境配置"
  cat > "$INSTALL_DIR/backend/.env.runtime" <<EOF
APP_NAME=$APP_NAME
DB_TYPE=$DB_TYPE
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME
DB_CHARSET=$DB_CHARSET
BACKEND_HOST=$BACKEND_HOST
BACKEND_PORT=$BACKEND_PORT
EOF
}

provision_mysql() {
  if [ "$MYSQL_PROVISION" != "1" ]; then
    log "已跳过 MySQL 建库建表"
    return
  fi

  if [ "$DB_TYPE" != "mysql" ]; then
    log "DB_TYPE=$DB_TYPE，跳过 MySQL 建库建表"
    return
  fi

  log "初始化 MySQL 数据库和表: $DB_NAME"
  cd "$INSTALL_DIR"
  INSTALL_DIR="$INSTALL_DIR" \
  SQL_SCHEMA_FILE_RELATIVE="$SQL_SCHEMA_FILE_RELATIVE" \
  DB_HOST="$DB_HOST" \
  DB_PORT="$DB_PORT" \
  DB_USER="$DB_USER" \
  DB_PASSWORD="$DB_PASSWORD" \
  DB_NAME="$DB_NAME" \
  DB_CHARSET="$DB_CHARSET" \
  MYSQL_ADMIN_HOST="$MYSQL_ADMIN_HOST" \
  MYSQL_ADMIN_PORT="$MYSQL_ADMIN_PORT" \
  MYSQL_ADMIN_USER="$MYSQL_ADMIN_USER" \
  MYSQL_ADMIN_PASSWORD="$MYSQL_ADMIN_PASSWORD" \
  backend/.venv/bin/python - <<'PY'
import os
from pathlib import Path

import pymysql


def sql_identifier(value: str) -> str:
    return f"`{value.replace('`', '``')}`"


def sql_literal(value: str) -> str:
    return "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'"


def split_sql(sql_text: str) -> list[str]:
    statements: list[str] = []
    buffer: list[str] = []
    for raw_line in sql_text.splitlines():
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("--"):
            continue
        buffer.append(raw_line)
        if stripped.endswith(";"):
            statement = "\n".join(buffer).strip()
            if statement.endswith(";"):
                statement = statement[:-1]
            if statement:
                statements.append(statement)
            buffer = []
    if buffer:
        statement = "\n".join(buffer).strip()
        if statement:
            statements.append(statement)
    return statements


install_dir = Path(os.environ["INSTALL_DIR"])
schema_path = install_dir / os.environ["SQL_SCHEMA_FILE_RELATIVE"]
if not schema_path.exists():
    raise FileNotFoundError(f"schema file not found: {schema_path}")

db_host = os.environ.get("DB_HOST", "127.0.0.1")
db_port = int(os.environ.get("DB_PORT", "3306"))
db_user = os.environ.get("DB_USER", "admin")
db_password = os.environ.get("DB_PASSWORD", "admin")
db_name = os.environ.get("DB_NAME", "life_app")
db_charset = os.environ.get("DB_CHARSET", "utf8mb4")

admin_user = os.environ.get("MYSQL_ADMIN_USER", "")
admin_password = os.environ.get("MYSQL_ADMIN_PASSWORD", "")
admin_host = os.environ.get("MYSQL_ADMIN_HOST", "")
admin_port = os.environ.get("MYSQL_ADMIN_PORT", "")

connect_host = admin_host or db_host
connect_port = int(admin_port or db_port)
connect_user = admin_user or db_user
connect_password = admin_password if admin_user else db_password

if admin_user:
    conn = pymysql.connect(
        host=connect_host,
        port=connect_port,
        user=connect_user,
        password=connect_password,
        charset=db_charset,
        autocommit=True,
    )
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                f"CREATE USER IF NOT EXISTS {sql_literal(db_user)}@'%' "
                f"IDENTIFIED BY {sql_literal(db_password)}"
            )
            cursor.execute(
                f"GRANT ALL PRIVILEGES ON {sql_identifier(db_name)}.* "
                f"TO {sql_literal(db_user)}@'%'"
            )
            cursor.execute("FLUSH PRIVILEGES")
    finally:
        conn.close()

sql_text = schema_path.read_text(encoding="utf-8")
sql_text = sql_text.replace("{{DB_NAME}}", sql_identifier(db_name))
sql_text = sql_text.replace("{{DB_CHARSET}}", db_charset)

conn = pymysql.connect(
    host=connect_host,
    port=connect_port,
    user=connect_user,
    password=connect_password,
    charset=db_charset,
    autocommit=True,
)
try:
    with conn.cursor() as cursor:
        for statement in split_sql(sql_text):
            cursor.execute(statement)
finally:
    conn.close()

print("MySQL database and tables are ready.")
PY
}

init_sqlite_when_needed() {
  if [ "$DB_TYPE" != "sqlite" ]; then
    return
  fi
  log "初始化 SQLite 数据库"
  cd "$INSTALL_DIR/backend"
  .venv/bin/python - <<'PY'
from app.database import init_db
init_db()
print("SQLite tables are ready.")
PY
}

stop_backend() {
  if [ -f "$BACKEND_PID_FILE" ]; then
    local pid
    pid="$(cat "$BACKEND_PID_FILE")"
    if [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1; then
      log "停止已有后端进程: $pid"
      kill "$pid" || true
      for _ in $(seq 1 20); do
        if ! kill -0 "$pid" >/dev/null 2>&1; then
          break
        fi
        sleep 0.5
      done
    fi
    rm -f "$BACKEND_PID_FILE"
  fi
}

start_backend() {
  log "启动后端服务"
  cd "$INSTALL_DIR/backend"
  stop_backend
  set -a
  # shellcheck disable=SC1091
  source "$INSTALL_DIR/backend/.env.runtime"
  set +a
  nohup .venv/bin/uvicorn app.main:app --host "$BACKEND_HOST" --port "$BACKEND_PORT" \
    >>"$BACKEND_LOG_FILE" 2>&1 &
  echo $! > "$BACKEND_PID_FILE"
  log "后端 PID: $(cat "$BACKEND_PID_FILE")"
}

health_check() {
  log "等待后端健康检查"
  for _ in $(seq 1 "$STARTUP_TIMEOUT"); do
    if curl -fsS "http://127.0.0.1:$BACKEND_PORT/" >/dev/null 2>&1; then
      log "部署完成"
      echo "访问地址: http://$(hostname -I 2>/dev/null | awk '{print $1}'):$BACKEND_PORT/"
      echo "本机检查: http://127.0.0.1:$BACKEND_PORT/"
      return
    fi
    sleep 1
  done
  echo "后端启动超时，请查看日志: $BACKEND_LOG_FILE" >&2
  exit 1
}

main() {
  ensure_not_root
  check_dependencies
  prepare_dirs
  sync_project
  install_backend_deps
  write_runtime_env
  provision_mysql
  init_sqlite_when_needed
  start_backend
  health_check
}

main "$@"
