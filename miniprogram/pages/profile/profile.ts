import { lifeApi } from '../../api/life';
import type { LifeRecord, Profile } from '../../types/life';

const emptyProfile: Profile = {
  user_id: 'demo-user',
  nickname: '来福用户',
  gender: '未设置',
  age: 32,
  height: 170,
  weight: 65,
  target_weight: 62,
  activity_level: '轻度',
  allergies: [],
  family_history: [],
  health_goals: ['规律记录', '均衡饮食', '每周运动3次']
};

Page({
  data: {
    profile: emptyProfile,
    records: [] as LifeRecord[],
    activeType: '',
    loading: true
  },
  onShow() {
    this.loadData();
  },
  async loadData() {
    try {
      const [profile, records] = await Promise.all([
        lifeApi.profile(),
        lifeApi.records(this.data.activeType || undefined)
      ]);
      this.setData({ profile, records, loading: false });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: '数据加载失败', icon: 'none' });
    }
  },
  switchType(event: any) {
    this.setData({ activeType: event.currentTarget.dataset.type as string }, () => this.loadData());
  }
});
