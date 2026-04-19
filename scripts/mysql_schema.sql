-- 来福 Life App MySQL schema.
-- deploy_linux.sh replaces {{DB_NAME}} and {{DB_CHARSET}} before executing.

CREATE DATABASE IF NOT EXISTS {{DB_NAME}} CHARACTER SET {{DB_CHARSET}} COLLATE utf8mb4_unicode_ci;

USE {{DB_NAME}};

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    nickname VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(500),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

CREATE TABLE IF NOT EXISTS profiles (
    user_id VARCHAR(64) PRIMARY KEY,
    gender VARCHAR(20),
    age INT,
    height DECIMAL(6,2),
    weight DECIMAL(6,2),
    target_weight DECIMAL(6,2),
    activity_level VARCHAR(32),
    allergies JSON,
    family_history JSON,
    health_goals JSON,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户健康档案表';

CREATE TABLE IF NOT EXISTS records (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    type VARCHAR(20) NOT NULL COMMENT 'diet/exercise/health',
    subtype VARCHAR(50),
    title VARCHAR(200) NOT NULL,
    content JSON NOT NULL,
    images JSON,
    ai_analysis JSON NOT NULL,
    calories INT NOT NULL DEFAULT 0,
    duration INT NOT NULL DEFAULT 0,
    distance DECIMAL(8,2) NOT NULL DEFAULT 0,
    health_metrics JSON,
    conversation_id VARCHAR(100),
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_records_user_id (user_id),
    INDEX idx_records_type (type),
    INDEX idx_records_recorded_at (recorded_at),
    CONSTRAINT fk_records_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='统一健康记录表';

CREATE TABLE IF NOT EXISTS consultations (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    summary VARCHAR(200) NOT NULL,
    messages JSON NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_consultations_user_id (user_id),
    INDEX idx_consultations_updated_at (updated_at),
    CONSTRAINT fk_consultations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='健康顾问咨询表';

CREATE TABLE IF NOT EXISTS reports (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    type VARCHAR(20) NOT NULL COMMENT 'weekly/monthly',
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    score DECIMAL(5,2) NOT NULL DEFAULT 0,
    title VARCHAR(200) NOT NULL,
    summary TEXT NOT NULL,
    content JSON NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_reports_user_id (user_id),
    INDEX idx_reports_type (type),
    INDEX idx_reports_created_at (created_at),
    CONSTRAINT fk_reports_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='健康报告表';

INSERT INTO users (id, nickname, avatar_url)
VALUES ('demo-user', '来福用户', '')
ON DUPLICATE KEY UPDATE nickname = VALUES(nickname);

INSERT INTO profiles (
    user_id, gender, age, height, weight, target_weight,
    activity_level, allergies, family_history, health_goals
)
VALUES (
    'demo-user',
    '未设置',
    32,
    170,
    65,
    62,
    '轻度',
    JSON_ARRAY(),
    JSON_ARRAY(),
    JSON_ARRAY('规律记录', '均衡饮食', '每周运动3次')
)
ON DUPLICATE KEY UPDATE
    age = VALUES(age),
    height = VALUES(height),
    weight = VALUES(weight),
    target_weight = VALUES(target_weight),
    activity_level = VALUES(activity_level);

