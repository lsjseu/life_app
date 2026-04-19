const { lifeApi } = require('../../api/life');

Page({
  data: {
    reports: [],
    activeType: 'daily',
    activeReports: [],
    currentReport: null,
    loading: true,
    typeLabels: {
      daily: '日报',
      weekly: '周报',
      monthly: '月报'
    }
  },
  onShow() {
    this.loadReports();
  },
  async loadReports() {
    try {
      const reports = await lifeApi.reports();
      this.updateReports(reports, this.data.activeType, false);
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: '报告加载失败', icon: 'none' });
    }
  },
  switchType(event) {
    this.updateReports(this.data.reports, event.currentTarget.dataset.type, this.data.loading);
  },
  updateReports(reports, activeType, loading) {
    const activeReports = reports.filter((item) => item.type === activeType);
    this.setData({
      reports,
      activeType,
      activeReports,
      currentReport: activeReports[0] || null,
      loading
    });
  }
});
