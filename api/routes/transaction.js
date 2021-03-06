var express = require('express')
var bodyparser = require('body-parser')

module.exports = function (wagner) {
  var api = express.Router()

  api.use(bodyparser.json())

  // GET ENTIRE TRANSACTION HISTORY FOR CURRENT USER
  api.get('/all', wagner.invoke(function (Transaction) {
    return function (req, res) {
      Transaction.find({email: req.user.email}, null, {sort: '-createdAt'}, function (err, transactions) {
        if (err) {
          return res
            .status(500)
            .json({error: err.toString()})
        }
        if (!transactions || transactions.length < 1) {
          res.json({error: 'No transactions available. Go buy some shares!'})
        } else {
          res.json({transactions: transactions})
        }
      }).limit(50)
    }
  }))

  return api
}
