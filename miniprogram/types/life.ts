export type RecordType = 'diet' | 'exercise' | 'health';
export type ReportType = 'weekly' | 'monthly';

export interface LifeMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: string;
  quick_actions?: string[];
}

export interface LifeRecord {
  id: string;
  user_id: string;
  type: RecordType;
  subtype?: string;
  title: string;
  content: Record<string, any>;
  images: string[];
  ai_analysis: Record<string, any>;
  calories: number;
  duration: number;
  distance: number;
  health_metrics: Record<string, any>;
  conversation_id?: string;
  recorded_at: string;
  created_at: string;
}

export interface HealthReport {
  id: string;
  user_id: string;
  type: ReportType;
  period_start: string;
  period_end: string;
  score: number;
  title: string;
  summary: string;
  content: {
    sections?: Array<{ title: string; items: string[] }>;
  };
  created_at: string;
}

export interface Dashboard {
  user_id: string;
  greeting: string;
  today: {
    diet_calories: number;
    exercise_calories: number;
    health_count: number;
    water_cups: number;
  };
  stats: {
    record_days: number;
    total_records: number;
    health_score: number;
  };
  recent_records: LifeRecord[];
  latest_report?: HealthReport | null;
}

export interface Profile {
  user_id: string;
  nickname: string;
  gender?: string;
  age?: number;
  height?: number;
  weight?: number;
  target_weight?: number;
  activity_level?: string;
  allergies: string[];
  family_history: string[];
  health_goals: string[];
}

