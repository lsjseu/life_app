import { lifeApi } from '../../api/life';
import type { Dashboard } from '../../types/life';

const emptyDashboard: Dashboard = {
  user_id: 'demo-user',
  greeting: '今天也和来福一起，好好照顾自己',
  today: {
    diet_calories: 0,
    exercise_calories: 0,
    health_count: 0,
    water_cups: 0
  },
  stats: {
    record_days: 0,
    total_records: 0,
    health_score: 82
  },
  recent_records: [],
  latest_report: null
};

Page({
  data: {
    loading: true,
    dashboard: emptyDashboard,
    recordVisible: false
  },
  onLoad() {
    this.loadDashboard();
  },
  onShow() {
    this.loadDashboard();
  },
  async loadDashboard() {
    try {
      const dashboard = await lifeApi.dashboard();
      this.setData({ dashboard, loading: false });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: '首页数据加载失败', icon: 'none' });
    }
  },
  openRecord() {
    this.setData({ recordVisible: true });
  },
  closeRecord() {
    this.setData({ recordVisible: false });
  },
  onRecordSaved() {
    this.loadDashboard();
  },
  goReport() {
    wx.switchTab({ url: '/pages/report/report' });
  },
  goAdvisor() {
    wx.switchTab({ url: '/pages/advisor/advisor' });
  },
  goProfile() {
    wx.switchTab({ url: '/pages/profile/profile' });
  }
});
