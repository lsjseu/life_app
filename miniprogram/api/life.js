const { DEFAULT_USER_ID } = require('../constants/config');
const { request } = require('./request');

const lifeApi = {
  dashboard() {
    return request({ url: `/home/dashboard?user_id=${DEFAULT_USER_ID}` });
  },
  startRecordConversation() {
    return request({
      url: '/record/conversations',
      method: 'POST'
    });
  },
  sendRecordMessage(payload) {
    return request({
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
  confirmRecord(payload) {
    return request({
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
  records(type) {
    return request({ url: `/records?user_id=${DEFAULT_USER_ID}${type ? `&type=${type}` : ''}` });
  },
  reports() {
    return request({ url: `/reports?user_id=${DEFAULT_USER_ID}` });
  },
  generateReport(type) {
    return request({
      url: '/reports/generate',
      method: 'POST',
      data: { user_id: DEFAULT_USER_ID, type }
    });
  },
  advisorMessage(payload) {
    return request({
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
    return request({
      url: `/advisor/sessions?user_id=${DEFAULT_USER_ID}`
    });
  },
  profile() {
    return request({ url: `/profile?user_id=${DEFAULT_USER_ID}` });
  }
};

module.exports = {
  lifeApi
};

