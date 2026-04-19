const { API_BASE_URL } = require('../constants/config');

function request(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data,
      timeout: 10000,
      header: {
        'content-type': 'application/json'
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          const message = res.data && (res.data.detail || res.data.message)
            ? `${res.data.detail || res.data.message}`
            : `HTTP ${res.statusCode}`;
          reject(new Error(message));
        }
      },
      fail: (error) => {
        reject(new Error(error.errMsg || 'request failed'));
      }
    });
  });
}

module.exports = {
  request
};
