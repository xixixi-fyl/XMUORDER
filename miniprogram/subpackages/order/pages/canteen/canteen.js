var util = require('../../../../utils/util.js')
var that
const app = getApp()
Page({
  /**
   * 页面的初始数据
   */
  data: {
    canteen: {},
    formatBsTime: [],
    TabCur: 0,
    MainCur: 0,
    VerticalNavTop: 0,
    load: true,
    showInfo: false,
    foodList: [],
    money: 0,
    allOrderList: {},
    orderList: {
      length: 0
    }, //已点食物的访问坐标数组 {index1|index2: [数量,index1,index2]}
    showShoppingCart: false,
    cIndex: null //在canteens数组中的序号
  },

  onLoad: function (options) {
    that = this
    var cIndex = options.index
    var canteen = app.globalData.canteens[cIndex]
    var foodList = canteen.foodList
    for (let i = 0; i < foodList.length; i++) {
      foodList[i].id = i;
    }

    if (!("allOrderList" in app.globalData)) {
      app.globalData.allOrderList = {}
    }


    var formatBsTime = []
    canteen.businessTime.forEach(timeBlock => {
      let timeMatch1 = timeBlock[0].match(/(.{2})(.{2})/)
      let timeMatch2 = timeBlock[1].match(/(.{2})(.{2})/)
      let timeStr1 = timeMatch1[1] + ':' + timeMatch1[2]
      let timeStr2 = timeMatch2[1] + ':' + timeMatch2[2]
      formatBsTime.push(timeStr1 + '-' + timeStr2)
    })

    that.setData({
      cIndex,
      foodList,
      canteen,
      formatBsTime,
      foodListCur: foodList[0],
      allOrderList: app.globalData.allOrderList
    })
    that.canteenRefresh()

    //如果全局变量中有该餐厅购物车信息，则更新到页面中
    var cID = that.data.canteen.cID
    if (cID in that.data.allOrderList) {
      var orderList = that.data.allOrderList[cID]
      var massages = []
      for (const key in orderList) {
        if (key === 'length') {
          continue
        }
        let addNum = orderList[key][0]
        let index1 = orderList[key][1]
        let index2 = orderList[key][2]
        let curNum = foodList[index1].food[index2].curNum
        if (addNum > curNum) {
          addNum = curNum
          massages.push(foodList[index1].food[index2].name)
        }
        that.foodOrderNumAdd(index1, index2, addNum, 'set')
      }
      if (massages.length > 0) {
        wx.showModal({
          title: '购物车提示',
          content: massages.join("、") + '  库存不足，已自动调整购买数量',
          showCancel: false,
          confirmText: '好的'
        })
      }
    }
  },
  onPullDownRefresh() { //下拉刷新数据
    that.canteenRefresh()
    wx.stopPullDownRefresh()
  },
  //跳转到其他页面时保存已点购物车
  onHide() {
    let cID = that.data.canteen.cID
    app.globalData.allOrderList[cID] = that.data.orderList
  },
  //页面退出时保存已点购物车
  onUnload() {
    let cID = that.data.canteen.cID
    app.globalData.allOrderList[cID] = that.data.orderList
  },
  deleteShoppingCart() { // 页面通信删除购物车
    // 清空本地数据避免退出时误保存
    that.setData({
      orderList: {
        length: 0
      }
    })
    //删除对应全局数据
    const cID = that.data.canteen.cID
    const cIndex = that.data.cIndex
    delete app.globalData.allOrderList[cID]
    var canteen = app.globalData.canteens[cIndex]
    canteen.foodList.forEach((element, index) => {
      canteen.foodList[index] = {
        id: element.id,
        name: element.name
      }
    })
  },
  tabSelect(e) {
    //滚动到底部保证可见
    wx.createSelectorQuery().select('.VerticalBox').boundingClientRect(function (rect) {
      rect.bottom // 节点的下边界坐标
    }).exec(res => {
      wx.pageScrollTo({
        scrollTop: res[0].bottom,
        duration: 300,
      })
    })

    that.setData({
      TabCur: e.currentTarget.dataset.id,
      MainCur: e.currentTarget.dataset.id,
      VerticalNavTop: (e.currentTarget.dataset.id - 1) * 50
    })
  },
  VerticalMain(e) {
    let that = this;
    let foodList = that.data.foodList;
    let tabHeight = 0;
    if (that.data.load) {
      for (let i = 0; i < foodList.length; i++) {
        let view = wx.createSelectorQuery().select("#main-" + foodList[i].id);
        view.fields({
          size: true
        }, data => {
          foodList[i].top = tabHeight;
          tabHeight = tabHeight + data.height;
          foodList[i].bottom = tabHeight;
        }).exec();
      }
      that.setData({
        load: false,
        foodList: foodList
      })
    }
    let scrollTop = e.detail.scrollTop + 20;
    for (let i = 0; i < foodList.length; i++) {
      if (scrollTop > foodList[i].top && scrollTop < foodList[i].bottom) {
        that.setData({
          VerticalNavTop: (foodList[i].id - 1) * 50,
          TabCur: foodList[i].id
        })
        return false
      }
    }
  },
  //餐厅信息折叠
  toggleInfo: function (event) {
    that.setData({
      showInfo: !that.data.showInfo
    })
  },
  numAddBtn: function (e) {
    let index1 = e.currentTarget.dataset.index1
    let index2 = e.currentTarget.dataset.index2
    that.foodOrderNumAdd(index1, index2)
  },
  foodOrderNumAdd: (index1, index2, num = 1, mode = 'change') => {
    var foodList = that.data.foodList
    var food = foodList[index1].food[index2]
    var orderList = that.data.orderList

    if ('orderNum' in food && mode === 'change') { //如果有这个键
      var orderNum = food.orderNum + num
    } else { //否则设置模式
      var orderNum = num
    }

    //判断库存是否足够，是否允许增加数量
    if (food.curNum >= orderNum) {
      //添加到购物车列表
      let orderItem = [orderNum, index1, index2]
      let key = index1.toString() + '|' + index2.toString()
      orderList[key] = orderItem
      orderList.length = Object.keys(orderList).length - 1 //减掉length本身


      //计算该类别已点数量
      var tpyeOrderNum = num //初始为这次要新增的数量
      foodList[index1].food.forEach(element => {
        if ('orderNum' in element) {
          tpyeOrderNum += element['orderNum']
        }
      })

      //计算合计价格
      var money = 0
      for (const key in orderList) {
        if (key === 'length') {
          continue
        }
        let i = orderList[key][1]
        let j = orderList[key][2]
        let price = that.data.foodList[i].food[j].price
        money += price * orderList[key][0]
      }

      // 保存结果
      // foodList[index1].food[index2].orderNum
      let s1 = 'foodList[' + index1 + '].food[' + index2 + '].orderNum'
      // foodList[index1].tpyeOrderNum
      let s2 = 'foodList[' + index1 + '].tpyeOrderNum'
      that.setData({
        [s1]: orderNum,
        [s2]: tpyeOrderNum,
        orderList: orderList,
        money: parseFloat(money.toFixed(2))
      })
    } else {
      util.showToast('库存不足')
    }
  },
  numDecBtn: function (e) {
    let index1 = e.currentTarget.dataset.index1
    let index2 = e.currentTarget.dataset.index2
    that.foodOrderNumDec(index1, index2)
  },
  foodOrderNumDec: (index1, index2, num = 1) => {
    var foodList = that.data.foodList
    var food = foodList[index1].food[index2]
    var orderList = that.data.orderList

    if ('orderNum' in food) { //如果有这个键
      var orderNum = food.orderNum - num
    } else {
      var orderNum = -1 //表明无需更改
    }

    // 是否需要更改
    if (orderNum >= 0) {
      //修改购物车列表
      let key = index1.toString() + '|' + index2.toString() //合并为字符串key
      if (orderNum === 0) {
        delete orderList[key]
      } else { //删除键值对
        let orderItem = [orderNum, index1, index2]
        orderList[key] = orderItem
      }
      orderList.length = Object.keys(orderList).length - 1 //减掉length属性本身

      //计算该类别已点数量
      var tpyeOrderNum = -1 * num //初始为这次要减少的数量
      foodList[index1].food.forEach(element => {
        if ('orderNum' in element) {
          tpyeOrderNum += element['orderNum']
        }
      })

      //计算合计价格
      var money = 0
      for (const key in orderList) {
        if (key === 'length') {
          continue
        }
        let i = orderList[key][1]
        let j = orderList[key][2]
        let price = that.data.foodList[i].food[j].price
        money += price * orderList[key][0]
      }

      // 保存结果
      // foodList[index1].food[index2].orderNum
      let s1 = 'foodList[' + index1 + '].food[' + index2 + '].orderNum'
      // foodList[index1].tpyeOrderNum
      let s2 = 'foodList[' + index1 + '].tpyeOrderNum'
      that.setData({
        [s1]: orderNum,
        [s2]: tpyeOrderNum,
        orderList: orderList,
        money: parseFloat(money.toFixed(2))
      })
    }
  },
  showShoppingCart: e => {
    that.setData({
      showShoppingCart: true
    })
  },
  hideShoppingCart: e => {
    that.setData({
      showShoppingCart: false
    })
  },
  toSettlement: function (e) {
    var orderList = that.data.orderList
    if (orderList.length > 0) {
      let settlement = {
        orderList: that.data.orderList,
        foodList: that.data.foodList,
        canteen: that.data.canteen,
        money: that.data.money
      }
      app.globalData.settlement = settlement
      wx.navigateTo({
        url: './settlement',
        events: {
          deleteShoppingCart: function () {
            that.deleteShoppingCart()
          }
        }
      })
    } else {
      util.showToast('请选择要购买的商品')
    }
  },
  canteenRefresh: function () { //刷新canteen数据
    const cID = that.data.canteen.cID
    util.showLoading('加载中')
    wx.cloud.callFunction({
        name: 'getCanteen',
        data: {
          cID: cID
        }
      })
      .then(res => {
        util.hideLoading()
        if (res.result.success) {
          var newFoodList = res.result.canteen.foodList
          var oldFoodList = that.data.foodList
          var massages = []
          oldFoodList.forEach((obj, index1) => {
            // 补全本地数据
            let keyList = ['tpyeOrderNum', 'id', 'top', 'bottom']
            keyList.forEach(keyName => {
              if (keyName in obj) {
                newFoodList[index1][keyName] = obj[keyName]
              }
            })

            if ("food" in obj) {
              obj.food.forEach((foodObj, index2) => {
                if ('orderNum' in foodObj) {
                  newFoodList[index1].food[index2].orderNum = foodObj.orderNum
                  if (foodObj.orderNum > newFoodList[index1].food[index2].curNum) { //已点数量大于现在的库存
                    // 计算要减少几份
                    let numDec = foodObj.orderNum - newFoodList[index1].food[index2].curNum
                    that.foodOrderNumDec(index1, index2, numDec)
                    massages.push(foodObj.name)
                  }
                }
              })
            }
          })
          // 更新canteen 并同步到全局
          var newCanteen = res.result.canteen
          var oldCanteen = that.data.canteen
          let keyList = ['inBusiness']
          keyList.forEach(keyName => {
            if (keyName in oldCanteen) {
              newCanteen[keyName] = oldCanteen[keyName]
            }
          })
          app.globalData.canteens[that.data.cIndex] = newCanteen

          that.setData({
            canteen: newCanteen,
            foodList: newFoodList
          })
          if (massages.length > 0) {
            wx.showModal({
              title: '购物车提示',
              content: massages.join("、") + '  库存不足，已自动调整购买数量',
              showCancel: false,
              confirmText: '好的'
            })
          }
        } else {
          util.showToast('数据刷新失败')
        }
      })
      .catch(e => {
        util.hideLoading()
        util.showToast('数据刷新失败')
      })
  },
  toGoodsDetail: function (e) {
    let index1 = e.currentTarget.dataset.index1
    let index2 = e.currentTarget.dataset.index2
    let cIndex = that.data.cIndex
    wx.navigateTo({
      url: './goodsDetail?index1=' + index1 + '&index2=' + index2 + '&cIndex=' + cIndex,
    })
  },
  blocking: e => {} //什么也不做
})