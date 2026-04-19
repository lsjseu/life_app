import { DEFAULT_USER_ID } from '../constants/config';
import { request } from './request';
import type { Dashboard, HealthReport, LifeMessage, LifeRecord, Profile, ReportType } from '../types/life';

export const lifeApi = {
  dashboard() {
    return request<Dashboard>({ url: `/home/dashboard?user_id=${DEFAULT_USER_ID}` });
  },
  startRecordConversation() {
    return request<{ conversation_id: string; message: LifeMessage }>({
      url: '/record/conversations',
      method: 'POST'
    });
  },
  sendRecordMessage(payload: { conversation_id?: string; text?: string; images?: string[] }) {
    return request<{ conversation_id: string; messages: LifeMessage[]; pending_record: Record<string, any> | null }>({
      url: '/record/message',
      method: 'POST',
      data: {
        user_id: DEFAULT_USER_ID,
        conversation_id: payload.conversation_id,
        text: payload.text || '',
        images: payload.images || []
      }
    });
  },
  confirmRecord(payload: { conversation_id: string; pending_record: Record<string, any>; confirmed: boolean; supplement?: string }) {
    return request<{ conversation_id: string; messages: LifeMessage[]; pending_record: Record<string, any> | null }>({
      url: '/record/confirm',
      method: 'POST',
      data: {
        user_id: DEFAULT_USER_ID,
        conversation_id: payload.conversation_id,
        pending_record: payload.pending_record,
        confirmed: payload.confirmed,
        supplement: payload.supplement
      }
    });
  },
  records(type?: string) {
    return request<LifeRecord[]>({ url: `/records?user_id=${DEFAULT_USER_ID}${type ? `&type=${type}` : ''}` });
  },
  reports() {
    return request<HealthReport[]>({ url: `/reports?user_id=${DEFAULT_USER_ID}` });
  },
  generateReport(type: ReportType) {
    return request<HealthReport>({
      url: '/reports/generate',
      method: 'POST',
      data: { user_id: DEFAULT_USER_ID, type }
    });
  },
  advisorMessage(payload: { session_id?: string; text: string }) {
    return request<{ session_id: string; messages: LifeMessage[] }>({
      url: '/advisor/message',
      method: 'POST',
      data: {
        user_id: DEFAULT_USER_ID,
        session_id: payload.session_id,
        text: payload.text
      }
    });
  },
  advisorSessions() {
    return request<Array<{ id: string; summary: string; messages: LifeMessage[]; updated_at: string }>>({
      url: `/advisor/sessions?user_id=${DEFAULT_USER_ID}`
    });
  },
  profile() {
    return request<Profile>({ url: `/profile?user_id=${DEFAULT_USER_ID}` });
  }
};

