var that
const app = getApp()
const util = require('../../../../utils/util.js')
const db = wx.cloud.database()

Page({
  data: {
    orders: [],
    currPage: 0,
    totalPage: 0,
    cID: ''
  },

  onLoad: function (options) {
    that = this
    that.setData({
      cID: app.globalData.identity.cID
    })
    that.getOrderByPage()
  },
  getOrderByPage: async function (currPage = 1, pageSize = 5) {
    util.showLoading('加载中')
    try {
      const cID = that.data.cID
      var countRes = await db.collection('orders').where({
        'goodsInfo.shopInfo.cID': cID, //所属餐厅（同时是数据库安全权限内容）
        'orderInfo.orderState': 'SUCCESS' //成功状态的订单
      }).count()

      const totalCount = countRes.total
      const totalPage = totalCount === 0 ? 0 : totalCount <= pageSize ? 1 : Math.ceil(totalCount / pageSize)
      if (totalPage === 0) { //如果没有任何记录
        wx.hideLoading()
        that.setData({
          orders: [],
          currPage: 0,
          totalPage: 0,
          totalCount: totalCount,
        })
        return
      }

      if (currPage > totalPage) {
        currPage = totalPage
      }

      var orderRes = await db.collection('orders').where({
        'goodsInfo.shopInfo.cID': cID, //所属餐厅（同时是数据库安全权限内容）
        'orderInfo.orderState': 'SUCCESS' // 成功状态的订单
      }).skip((currPage - 1) * pageSize).limit(pageSize).get()

      wx.hideLoading()
      orderRes.data.forEach(order => {
        order.userInfo.phoneEnd = order.userInfo.phone.slice(-4)
        order.orderInfo.timeInfo.formatedEndTime = that.strDateFormat(order.orderInfo.timeInfo.endTime)
      })

      that.setData({
        orders: orderRes.data,
        currPage: currPage,
        totalPage: totalPage,
        totalCount: totalCount,
      })
      return
    } catch (e) {
      wx.hideLoading()
      util.showToast('加载失败', 'error')
      setTimeout(() => {
        wx.navigateBack({
          delta: 1,
        })
      }, 1000);
    }
  },
  changePage: function (e) {
    const dataset = e.currentTarget.dataset
    let currPage = that.data.currPage
    let totalPage = that.data.totalPage

    if ('add' in dataset) { //增加
      if (currPage <= totalPage - 1) {
        that.getOrderByPage(currPage + 1)
      } else {
        util.showToast('已经是最后一页啦')
      }
    } else { //减少
      if (currPage > 1) {
        that.getOrderByPage(currPage - 1)
      } else {
        util.showToast('已经是第一页啦')
      }
    }
  },
  strDateFormat: strDate => { //14位日期转yyyy-MM-dd hh:mm:ss
    var regExp = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/;
    var formatTime = '$1-$2-$3 $4:$5:$6';
    return strDate.replace(regExp, formatTime)
  }
})