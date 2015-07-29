var ColoAccess = require('../src/coluaccess.js')

var settings = {
  network: 'mainnet',
  privateSeed: 'c507290be50bca9b887af39019f80e3f9f27e4020ee0a4fe51595ee4424d6151',
  companyName: 'My company'
}

var coluAccess = new ColoAccess(settings)

coluAccess.on('connect', function () {
  // This is your private seed, keep it safe!!!
  console.log('seed: ' + coluAccess.colu.hdwallet.getPrivateSeed())

  var assetId = 'U6R7Dh1nzqG6PRxPtWQo2paXYJkoTibYFp7GS'
  var username = 'bobicbob30'

  coluAccess.verifyUser(username, assetId, function (err, data) {
    if (err) return console.log('Error: ' + JSON.stringify(err))
    console.log('data:' + JSON.stringify(data))
    process.exit()
  })
})

coluAccess.init()
