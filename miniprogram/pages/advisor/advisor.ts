import { lifeApi } from '../../api/life';
import type { LifeMessage } from '../../types/life';

Page({
  data: {
    tab: 'chat',
    sessionId: '',
    messages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: '您好！我是您的AI健康顾问，可以帮你解读饮食、运动和健康指标。',
        time: '现在',
        quick_actions: ['血糖偏高怎么吃？', '今天饮食怎么样？', '血压怎么管理？']
      }
    ] as LifeMessage[],
    sessions: [] as Array<{ id: string; summary: string; messages: LifeMessage[]; updated_at: string }>,
    inputText: '',
    thinking: false
  },
  onShow() {
    this.loadSessions();
  },
  switchTab(event: any) {
    this.setData({ tab: event.currentTarget.dataset.tab as string });
  },
  onInput(event: any) {
    this.setData({ inputText: event.detail.value });
  },
  useQuick(event: any) {
    this.setData({ inputText: event.currentTarget.dataset.text as string });
  },
  async send() {
    const text = this.data.inputText.trim();
    if (!text) return;
    this.setData({ thinking: true, inputText: '' });
    try {
      const res = await lifeApi.advisorMessage({
        session_id: this.data.sessionId || undefined,
        text
      });
      this.setData({
        sessionId: res.session_id,
        messages: [...this.data.messages, ...res.messages],
        thinking: false
      });
      this.loadSessions();
    } catch (error) {
      this.setData({ thinking: false });
      wx.showToast({ title: '顾问暂时离线', icon: 'none' });
    }
  },
  async loadSessions() {
    try {
      const sessions = await lifeApi.advisorSessions();
      this.setData({ sessions });
    } catch (error) {
      // keep silent on first empty state
    }
  },
  openSession(event: any) {
    const session = this.data.sessions.find((item) => item.id === event.currentTarget.dataset.id);
    if (!session) return;
    this.setData({ tab: 'chat', sessionId: session.id, messages: session.messages });
  }
});
