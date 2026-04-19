#!/usr/bin/env bash

load_life_app_config() {
  local script_dir="$1"
  local config_file="${LIFE_APP_CONFIG_FILE:-$script_dir/life_app.conf}"
  [ -f "$config_file" ] || return

  while IFS='=' read -r key value; do
    key="${key%%#*}"
    key="${key//[[:space:]]/}"
    value="${value%%#*}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] && [ -n "$value" ] && [ -z "${!key:-}" ]; then
      printf -v "$key" '%s' "$value"
      export "$key"
    fi
  done < "$config_file"
}

apply_life_app_runtime_config() {
  if [ "${USE_SQLITE:-${LINUX_USE_SQLITE:-0}}" = "1" ]; then
    export DB_TYPE="sqlite"
  else
    export DB_TYPE="${DB_TYPE:-mysql}"
  fi

  export LIFE_APP_LOG_DIR="${LIFE_APP_LOG_DIR:-$LOG_DIR}"
}

