const { lifeApi } = require('../../api/life');

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    }
  },
  data: {
    conversationId: '',
    messages: [],
    inputText: '',
    selectedImages: [],
    pendingRecord: null,
    isProcessing: false
  },
  observers: {
    visible(visible) {
      if (visible && !this.data.conversationId) {
        this.initConversation();
      }
    }
  },
  methods: {
    async initConversation() {
      this.setData({
        conversationId: `local-${Date.now()}`,
        messages: [
          {
            id: 'welcome',
            role: 'assistant',
            content: '你好！想记录点什么？可以说话、拍照或打字告诉我',
            time: this.formatTime(),
            quick_actions: ['我吃了...', '我运动了...', '我量了...']
          }
        ],
        pendingRecord: null,
        inputText: '',
        selectedImages: []
      });
    },
    formatTime() {
      const now = new Date();
      return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    },
    onClose() {
      this.triggerEvent('close');
    },
    onInput(event) {
      this.setData({ inputText: event.detail.value });
    },
    useTip(event) {
      const text = event.currentTarget.dataset.text;
      this.setData({ inputText: text });
    },
    async chooseImage() {
      try {
        const res = await wx.chooseMedia({
          count: 3,
          mediaType: ['image'],
          sourceType: ['camera', 'album']
        });
        this.setData({
          selectedImages: res.tempFiles.map((file) => file.tempFilePath)
        });
      } catch (error) {
        wx.showToast({ title: '已取消选择', icon: 'none' });
      }
    },
    startVoice() {
      wx.showToast({ title: '语音占位：请先用文字输入', icon: 'none' });
    },
    async sendMessage() {
      const text = this.data.inputText.trim();
      if (!text && this.data.selectedImages.length === 0) return;
      this.setData({ isProcessing: true });
      try {
        const res = await lifeApi.sendRecordMessage({
          conversation_id: this.data.conversationId,
          text,
          images: this.data.selectedImages
        });
        this.setData({
          conversationId: res.conversation_id,
          messages: [...this.data.messages, ...res.messages],
          pendingRecord: res.pending_record,
          inputText: '',
          selectedImages: [],
          isProcessing: false
        });
      } catch (error) {
        this.setData({ isProcessing: false });
        wx.showModal({
          title: '请求失败',
          content: `无法连接来福服务：${error.message || error}\n请确认已重新预览，并且服务器 8000 端口可访问。`,
          showCancel: false
        });
      }
    },
    async quickAction(event) {
      const action = event.currentTarget.dataset.action;
      if (action === '完成') {
        this.triggerEvent('saved');
        this.onClose();
        return;
      }
      if (action === '继续记录') {
        this.setData({ inputText: '' });
        return;
      }
      if (!this.data.pendingRecord) {
        this.setData({ inputText: action });
        return;
      }
      if (action === '对的' || action === '是的') {
        await this.confirm(true);
        return;
      }
      if (action === '不对' || action === '不是') {
        await this.confirm(false);
        return;
      }
      if (action === '补充') {
        this.setData({ inputText: '补充：' });
      }
    },
    async confirm(confirmed) {
      if (!this.data.pendingRecord) return;
      this.setData({ isProcessing: true });
      try {
        const res = await lifeApi.confirmRecord({
          conversation_id: this.data.conversationId,
          pending_record: this.data.pendingRecord,
          confirmed
        });
        this.setData({
          messages: [...this.data.messages, ...res.messages],
          pendingRecord: res.pending_record,
          isProcessing: false
        });
        if (confirmed) {
          this.triggerEvent('saved');
        }
      } catch (error) {
        this.setData({ isProcessing: false });
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    }
  }
});
