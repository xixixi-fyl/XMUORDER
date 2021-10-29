// subpackages/order/pages/feedback/index.js
var that
const app = getApp()
Page({

  /**
   * 页面的初始数据
   */
  data: {
    feedbacks:[]
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    var that = this
    wx.showLoading({
      title: '加载中',
      mask: true
    })
    wx.cloud.callFunction({
      name:'getFeedback',
    }).then(res => {
      wx.hideLoading()
      that.setData({
        feedbacks : res.result.res.data
      })
    })
  },
})