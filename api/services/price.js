var bunyan = require('bunyan')
var log = bunyan.createLogger({name: 'priceService'})

var Client = require('node-rest-client').Client
var priceClient = new Client()

var INVESTFLY_API = 'https://api.investfly.com/stockmarket/quotes'
var INVESTFLY_API_SINGLE = 'https://api.investfly.com/stockmarket/quote?'
// var MARKETS = ['US', 'LSE', 'EURO', 'TMX', 'HKE', 'INDIA']

function updatePrices (wagner, market) {
  if (!market) return

  wagner.invoke(function (Price) {
    Price.find({market: market}, function (err, results) {
      if (err) {
        log.error(err)
        return
      }

      if (results.length > 0) {
        console.log(Date.now() + ' - Found symbols for ' + market)
        var symbols = []

        for (var j = 0; j < results.length; j++) {
          symbols.push(results[j].symbol)
        }
        getPrices(Price, market, symbols)
        console.log(Date.now() + ' - Price update for ' + market)
      }
    })
  })
}

// SEND POST REQ TO API, GET PRICES AND SAVE TO DB
function getPrices (Price, market, symbols) {
  var args = {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    data: {
      'market': market,
      'realTime': true,
      'tickers': symbols
    }
  }

  priceClient.post(INVESTFLY_API, args, function (data, res) {
    log.info('Connecting to Investfly Stock API: ' + res.statusCode + ' (' + res.statusMessage + ')')

    if (res.statusCode === 200) {
      log.info('Updating ' + data.count + ' symbols in market ' + market)
      var results = data.result

      for (const stock of Object.keys(results)) {
        savePrice(Price, results[stock].symbol, results[stock].lastPrice, results[stock].market)
      }
    } else if (market === 'US') {
      // Get quote somewhere else
      // Only US stock available for backup API
      var ROBINHOOD_API = 'https://api.robinhood.com/quotes/?symbols='

      // Maximum symbols allowed is 1630
      if (symbols.length > 1630) {
        symbols.length = 1630
      }

      priceClient.get(ROBINHOOD_API + symbols.toString(), function (data, res) {
        log.info('Connecting to Robinhood Stock API: ' + res.statusCode + ' (' + res.statusMessage + ')')

        if (res.statusCode === 200) {
          var results = data.results

          results.forEach(function (stock) {
            if (stock !== null) {
              savePrice(Price, stock.symbol, stock.ask_price, 'US')
            }
          })
        }
      })
    } else {
      log.info('Could not update prices for ' + market)
    }
  })
}

function getPrice (Price, market, symbol, cb) {
  var args = {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  }
  priceClient.get(INVESTFLY_API_SINGLE + 'symbol=' + symbol + '&market=' + market + '&realtime=true',
    args, function (data, res) {
      log.info('Connecting to Investfly Stock API Single Quote (' + symbol + ' / ' + market + '): ' + res.statusCode + ' (' + res.statusMessage + ')')

      if (res.statusCode === 200) {
        savePrice(Price, data.symbol, data.lastPrice, data.market, function (result) {
          cb(null, result)
        })
      }

      if (res.statusCode === 400) {
        cb('Cannot get price for ' + symbol + ' or symbol doesn\'t exist', null)
      }
    })
}

function savePrice (Price, symbol, price, market, cb) {
  Price.findOneAndUpdate({symbol: symbol}, {
    $set: {
      price: price,
      market: market
    }
  }, {upsert: true, new: true}, function (err, result) {
    if (err) {
      log.info('Error on priceService (savePrice) - ' + symbol + ' / ' + market + ' Message: ' + err)
    }

    if (cb) {
      cb(result)
    }
  })
}

module.exports = {
  updatePrices: updatePrices,
  getPrice: getPrice
}
