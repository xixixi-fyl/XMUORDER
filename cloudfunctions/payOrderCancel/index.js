const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

//返回16位随机字母字符串
function getNonceStr() {
  var out = ''
  for (let i = 0; i < 4; i++) {
    out += Math.random().toString(36).slice(-4)
  }
  return out
}

//返回14位字符串日期20210102030405
function getStrDate(date) {
  let year = date.getFullYear()
  let month = (date.getMonth() + 1).toString().padStart(2, '0')
  let day = date.getDate().toString().padStart(2, '0')
  let hour = date.getHours().toString().padStart(2, '0')
  let min = date.getMinutes().toString().padStart(2, '0')
  let sec = date.getSeconds().toString().padStart(2, '0')
  return year + month + day + hour + min + sec
}

const db = cloud.database()
const _ = db.command
// 云函数入口函数
exports.main = async (event, context) => {
  try {
    const outTradeNo = event.outTradeNo

    //读取数据库订单
    var dbRes = await db.collection('orders').where({
      'orderInfo.outTradeNo': outTradeNo
    }).limit(1).get()
    const order = dbRes.data[0]

    const subMchId = order.goodsInfo.shopInfo.subMchId
    const totalFee = order.payInfo.feeInfo.totalFee


    //定义修改对象
    var formData = {
      'orderInfo.orderState': 'CLOSED',
      'orderInfo.orderStateMsg': '已取消',
    }

    // 退款
    if (order.orderInfo.orderState === 'NOTCONFIRM') {
      var refundRes = await cloud.cloudPay.refund({
        envId: 'cloud1-4g4b6j139b4e50e0', //云开发中复制
        subMchId: subMchId,
        nonce_str: getNonceStr(),
        outTradeNo: outTradeNo,
        out_refund_no: 'REFUND' + outTradeNo,
        totalFee: totalFee,
        refundFee: totalFee
      })

      if ('rejectOrder' in event) { // 卖家拒单
        formData['orderInfo.orderState'] = 'NOTACCEPT'
        formData['orderInfo.orderStateMsg'] = '被拒'
        formData['orderInfo.notAcceptReason'] = 'rejectReason' in event? event.rejectReason: '其他原因'
      }

      if (refundRes.resultCode === 'SUCCESS' && refundRes.returnCode === 'SUCCESS') {
        console.log("退款成功")
        formData['payInfo.tradeState'] = 'REFUND'
        formData['payInfo.tradeStateMsg'] = '转入退款'
      } else {
        console.log("退款失败", refundRes)
        formData['payInfo.tradeState'] = 'REFUNDERROR'
        formData['payInfo.tradeStateMsg'] = '退款失败'
      }

    } else if (order.orderInfo.orderState === 'NOTPAY') {
      // NOTPAY则关闭订单
      await cloud.cloudPay.closeOrder({
        out_trade_no: outTradeNo,
        sub_mch_id: subMchId,
        nonce_str: getNonceStr()
      })
      console.log('接口关闭订单')
    } else { // 其他订单状态无法取消订单
      return {
        success: false,
        errorMsg: '订单当前状态无法取消'
      }
    }

    formData['orderInfo.timeInfo.endTime'] = getStrDate(new Date())

    // 修改订单状态
    await db.collection('orders').doc(order._id).update({
      data: formData
    })

    try { //释放库存
      let record = order.goodsInfo.record
      let proList = []
      record.forEach(food => {
        proList.push(
          db.collection('food').doc(food._id).update({
            data: {
              curNum: _.inc(food.num),
              allNum: _.inc(food.num)
            }
          })
        )
      })
      await Promise.all(proList)
      console.log('释放库存成功')
    } catch (err) {
      console.log('释放库存出错', err)
    }


    return {
      success: true,
      errorMsg: '订单取消成功'
    }
  } catch (error) {
    console.error(error)
    return {
      success: false,
      errorMsg: error.message
    }
  }
}