var fs = require('fs')
var ColoAccess = require('../src/coluaccess.js')

var settings = {
  privateSeed: 'c507290be50bca9b887af39019f80e3f9f27e4020ee0a4fe51595ee4424d6151',
  companyName: 'My company'
}

var coluAccess = new ColoAccess(settings)

coluAccess.on('connect', function () {
  // This is your private seed, keep it safe!!!
  console.log('seed: ' + coluAccess.colu.hdwallet.getPrivateSeed())

  var username = 'bobicbob30'
  var registrationMessage = coluAccess.createRegistrationMessage(username)

  // You can create your own complicated qr code, or you can generate a simplified code and get it back from us in a callback.
  // var qr = coluAccess.createRegistrationQR(registrationMessage)

  coluAccess.getRegistrationQR(registrationMessage, function (err, code, qr) {
    if (err) return console.error('error: ' + err)
    // You can use the QR in your site using it as src of img tag:
    // '<img src="'  +  qr  +  '" alt="Scan Me" height="200" width="200">'
    // or you can write it to a file like that:

    function decodeBase64Image (dataString) {
      var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
      var response = {}

      if (matches.length !== 3) {
        return new Error('Invalid input string')
      }
      response.type = matches[1]
      response.data = new Buffer(matches[2], 'base64')

      return response
    }

    var imageBuffer = decodeBase64Image(qr)

    var filename = 'qr.jpg'
    fs.writeFile(filename, imageBuffer.data, function (err) {
    // fs.writeFile(filename, new Buffer(qr, "base64"), function (err) {
      if (err) console.error(err)
    })

    // Now you can show the QR to the user to scan, and prompt our server for an answer when the user register successfully:

    coluAccess.registerUser({registrationMessage: registrationMessage, code: code}, function (err, data) {
      if (err) return console.log('Error: ' + JSON.stringify(err))
      console.log('data:' + JSON.stringify(data))
      process.exit()
    })
  })
})

coluAccess.init()
