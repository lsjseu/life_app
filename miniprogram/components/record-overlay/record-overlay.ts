import { lifeApi } from '../../api/life';
import type { LifeMessage } from '../../types/life';

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    }
  },
  data: {
    conversationId: '',
    messages: [] as LifeMessage[],
    inputText: '',
    selectedImages: [] as string[],
    pendingRecord: null as Record<string, any> | null,
    isProcessing: false
  },
  observers: {
    visible(visible: boolean) {
      if (visible && !this.data.conversationId) {
        this.initConversation();
      }
    }
  },
  methods: {
    async initConversation() {
      try {
        const res = await lifeApi.startRecordConversation();
        this.setData({
          conversationId: res.conversation_id,
          messages: [res.message],
          pendingRecord: null,
          inputText: '',
          selectedImages: []
        });
      } catch (error) {
        wx.showToast({ title: '服务暂不可用', icon: 'none' });
      }
    },
    onClose() {
      this.triggerEvent('close');
    },
    onInput(event: any) {
      this.setData({ inputText: event.detail.value });
    },
    useTip(event: any) {
      const text = event.currentTarget.dataset.text as string;
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
        wx.showToast({ title: 'AI分析失败，请重试', icon: 'none' });
      }
    },
    async quickAction(event: any) {
      const action = event.currentTarget.dataset.action as string;
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
    async confirm(confirmed: boolean) {
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
