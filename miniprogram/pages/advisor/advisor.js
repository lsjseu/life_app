const { lifeApi } = require('../../api/life');

function buildLocalAdvisorReply(text) {
  if (text.includes('血压')) {
    return '我先给你一个本地健康建议：血压管理要关注低盐饮食、规律作息和持续测量。测量前静坐 5 分钟，连续测 2 次取平均。如果多次高于 140/90，或伴随头晕、胸闷、胸痛，请及时就医。';
  }
  if (text.includes('血糖')) {
    return '我先给你一个本地健康建议：血糖偏高时，建议减少含糖饮料和精制碳水，主食优先选择全谷物，并搭配蛋白质和蔬菜。若连续多次异常，请带记录咨询医生。';
  }
  if (text.includes('饮食') || text.includes('吃')) {
    return '我先给你一个本地健康建议：每餐尽量包含蔬菜、优质蛋白和适量主食，少油少糖。你可以继续记录三餐，来福会结合趋势给出更具体建议。';
  }
  if (text.includes('运动') || text.includes('跑步') || text.includes('快走')) {
    return '我先给你一个本地健康建议：如果刚开始恢复运动，先从快走、骑行等低冲击运动开始，每周逐步增加时长。运动后注意补水和拉伸。';
  }
  return '我先给你一个本地健康建议：可以继续记录饮食、运动、血压、血糖、体重和睡眠。等服务器顾问恢复后，我会结合你的历史记录给出更完整的分析。若有明显不适或指标持续异常，请及时就医。';
}

function localMessage(role, content, quickActions) {
  const now = new Date();
  return {
    id: `${role}-${now.getTime()}`,
    role,
    content,
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    quick_actions: quickActions || []
  };
}

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
    ],
    sessions: [],
    inputText: '',
    thinking: false
  },
  onShow() {
    this.loadSessions();
  },
  switchTab(event) {
    this.setData({ tab: event.currentTarget.dataset.tab });
  },
  onInput(event) {
    this.setData({ inputText: event.detail.value });
  },
  useQuick(event) {
    this.setData({ inputText: event.currentTarget.dataset.text });
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
      const fallbackMessages = [
        localMessage('user', text),
        localMessage('assistant', buildLocalAdvisorReply(text), ['记录健康指标', '生成周报', '继续提问'])
      ];
      this.setData({
        messages: [...this.data.messages, ...fallbackMessages],
        thinking: false
      });
      wx.showModal({
        title: '已切换本地建议',
        content: `服务器顾问暂时不可用，已先给出本地建议。\n\n错误：${error.message || error.errMsg || '请求失败'}`,
        showCancel: false,
        confirmText: '知道了'
      });
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
  openSession(event) {
    const session = this.data.sessions.find((item) => item.id === event.currentTarget.dataset.id);
    if (!session) return;
    this.setData({ tab: 'chat', sessionId: session.id, messages: session.messages });
  }
});
