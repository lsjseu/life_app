import { lifeApi } from '../../api/life';
import type { HealthReport, ReportType } from '../../types/life';

Page({
  data: {
    reports: [] as HealthReport[],
    activeType: 'weekly' as ReportType,
    loading: true,
    generating: false
  },
  onShow() {
    this.loadReports();
  },
  async loadReports() {
    try {
      const reports = await lifeApi.reports();
      this.setData({ reports, loading: false });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: '报告加载失败', icon: 'none' });
    }
  },
  switchType(event: any) {
    this.setData({ activeType: event.currentTarget.dataset.type as ReportType });
  },
  async generateReport() {
    this.setData({ generating: true });
    try {
      const report = await lifeApi.generateReport(this.data.activeType);
      this.setData({ reports: [report, ...this.data.reports], generating: false });
      wx.showToast({ title: '报告已生成', icon: 'success' });
    } catch (error) {
      this.setData({ generating: false });
      wx.showToast({ title: '生成失败', icon: 'none' });
    }
  }
});
