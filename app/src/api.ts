import type { Dashboard, HealthReport, LifeMessage, LifeRecord, Profile, ReportType } from './types';

const DEFAULT_BASE_URL = 'http://127.0.0.1:8000/api/v1';
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_BASE_URL;
export const DEFAULT_USER_ID = 'demo-user';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const lifeApi = {
  dashboard() {
    return request<Dashboard>(`/home/dashboard?user_id=${DEFAULT_USER_ID}`);
  },
  records(type?: string) {
    return request<LifeRecord[]>(`/records?user_id=${DEFAULT_USER_ID}${type ? `&type=${type}` : ''}`);
  },
  reports() {
    return request<HealthReport[]>(`/reports?user_id=${DEFAULT_USER_ID}`);
  },
  generateReport(type: ReportType) {
    return request<HealthReport>('/reports/generate', {
      method: 'POST',
      body: JSON.stringify({ user_id: DEFAULT_USER_ID, type })
    });
  },
  profile() {
    return request<Profile>(`/profile?user_id=${DEFAULT_USER_ID}`);
  },
  startRecordConversation() {
    return request<{ conversation_id: string; message: LifeMessage }>('/record/conversations', {
      method: 'POST'
    });
  },
  sendRecordMessage(payload: { conversation_id?: string; text?: string; images?: string[] }) {
    return request<{ conversation_id: string; messages: LifeMessage[]; pending_record: Record<string, unknown> | null }>(
      '/record/message',
      {
        method: 'POST',
        body: JSON.stringify({
          user_id: DEFAULT_USER_ID,
          conversation_id: payload.conversation_id,
          text: payload.text || '',
          images: payload.images || []
        })
      }
    );
  },
  confirmRecord(payload: { conversation_id: string; pending_record: Record<string, unknown>; confirmed: boolean; supplement?: string }) {
    return request<{ conversation_id: string; messages: LifeMessage[]; pending_record: Record<string, unknown> | null }>(
      '/record/confirm',
      {
        method: 'POST',
        body: JSON.stringify({
          user_id: DEFAULT_USER_ID,
          conversation_id: payload.conversation_id,
          pending_record: payload.pending_record,
          confirmed: payload.confirmed,
          supplement: payload.supplement
        })
      }
    );
  },
  advisorMessage(payload: { session_id?: string; text: string }) {
    return request<{ session_id: string; messages: LifeMessage[] }>('/advisor/message', {
      method: 'POST',
      body: JSON.stringify({
        user_id: DEFAULT_USER_ID,
        session_id: payload.session_id,
        text: payload.text
      })
    });
  },
  advisorSessions() {
    return request<Array<{ id: string; summary: string; messages: LifeMessage[]; updated_at: string }>>(
      `/advisor/sessions?user_id=${DEFAULT_USER_ID}`
    );
  }
};

