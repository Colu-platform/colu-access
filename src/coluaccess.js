var Colu = require('colu')
var util = require('util')
var events = require('events')
var assert = require('assert')
var crypto = require('crypto')
var request = require('request')
var qr = require('qr-encode')
var async = require('async')
var bitcoin = require('bitcoinjs-lib')

var User = require('./user.js')

var ColuAccess = function (settings) {
  var self = this

  settings = settings || {}

  self.companyName = settings.companyName || 'New Company'
  self.companyIcon = settings.companyIcon
  if (self.companyIcon) {
    self.companyIconMIMEType = settings.companyIconMIMEType || 'image/jpeg'
    self.companyIconDataHash = settings.companyIconDataHash
  }
  self.issuerHomepage = settings.issuerHomepage
  self.colu = new Colu(settings)
  self.coluHost = self.colu.coluHost
  self.network = self.colu.network
  self.colu.on('connect', function () {
    self.emit('connect')
  })

  self.colu.on('error', function (err) {
    self.emit('error', err)
  })
}

util.inherits(ColuAccess, events.EventEmitter)

ColuAccess.prototype.init = function (cb) {
  var self = this
  self.colu.init(function (err, coluInstance) {
    if (err) {
      if (cb) return cb(err)
      throw err
    }
    if (cb) cb(null, self)
  })
}

ColuAccess.User = User

ColuAccess.prototype.createRegistrationMessage = function (username, account) {
  var self = this

  assert(username, 'Need username as first argument.')
  assert(!self.colu.hdwallet.needToDiscover, 'ColuAccess instance need to init using coluAccess.init(callback) method')
  var rand = crypto.randomBytes(10)
  rand = rand.toString('hex')
  var utcTS = Date.now().toString()
  var message = {
    username: username,
    timestamp: utcTS,
    rand: rand
  }
  var messageStr = JSON.stringify(message)
  var privateKey = self.colu.hdwallet.getPrivateKey(account)
  var signature = ecdsaSign(messageStr, privateKey)
  var jsonSignature = JSON.stringify(signature)
  var publicKey = self.colu.hdwallet.getPublicKey(account || self.colu.hdwallet.nextAccount - 1)
  var registrationMessage = {
    message: messageStr,
    company_public_key: publicKey.toHex(),
    signature: jsonSignature,
    company_name: self.companyName
  }
  return registrationMessage
}

ColuAccess.prototype.createRegistrationQR = function (registrationMessage) {
  // var self = this
  assertRegistrationMessage(registrationMessage)
  var dataURI = qr(JSON.stringify(registrationMessage), {type: 15, size: 10, level: 'L'})
  return dataURI
}

ColuAccess.prototype.getRegistrationQR = function (registrationMessage, callback) {
  var self = this

  assertRegistrationMessage(registrationMessage)
  assert.equal(typeof callback, 'function', 'Need callback function as last (second) argument.')
  registrationMessage.by_code = true
  request.post(self.coluHost + '/start_user_registration_to_company',
    {json: registrationMessage },
    function (err, response, body) {
      if (err) {
        return callback(err)
      }
      if (response.statusCode !== 200) {
        return callback(body)
      }
      if ('code' in body) {
        var simpleQrLink = self.coluHost + '/qr?code=' + body.code
        var dataURI = qr(simpleQrLink, {type: 5, size: 5, level: 'M'})
        callback(null, body.code, dataURI)
      } else {
        callback('No code returned from server')
      }
    }
  )
}

ColuAccess.prototype.registerUser = function (args, callback) {
  var self = this

  var registrationMessage = args.registrationMessage
  var code = args.code
  var phonenumber = args.phonenumber

  assertRegistrationMessage(registrationMessage)

  assert.equal(typeof callback, 'function', 'Need callback function as last argument.')

  var user
  var assetInfo
  async.waterfall([
    function (cb) {
      var url = self.coluHost + '/start_user_registration_to_company'
      var json
      if (code) {
        url = url + '_by_code'
        json = {code: code}
      } else {
        if (phonenumber) {
          registrationMessage.phonenumber = phonenumber
        }
        json = registrationMessage
      }
      request.post(
        url,
        {json: json},
        cb
      )
    },
    function (response, body, cb) {
      if (response.statusCode !== 200) {
        return cb(new Error(body))
      }
      user = parseRegistrationBody(body)
      if (!user) return cb('Wrong answer from server.')
      var client_public_key = user.getRootPublicKey()
      var messageVerified = verifyMessage(registrationMessage, body.verified_client_signature, client_public_key, body.verified, body.client_message_str, self.network)
      if (!messageVerified) return cb('Signature not verified.')
      var username = ColuAccess.getUsername(registrationMessage)
      var companyPublicKey = bitcoin.ECPubKey.fromHex(registrationMessage.company_public_key)
      var toAddress = user.getAddress()
      self.accessIssue(companyPublicKey, toAddress, username, cb)
    },
    function (l_assetInfo, cb) {
      assetInfo = l_assetInfo
      assetInfo.userId = user.getId()
      var url = self.coluHost + '/finish_registration_to_company'
      request.post(
        url,
        {json: {asset_data: assetInfo}},
        cb
      )
    }
  ],
  function (err, res) {
    if (err) {
      return callback(err)
    }
    return callback(null, assetInfo)
  })
}

ColuAccess.prototype.accessIssue = function (publicKey, toAddress, username, callback) {
  var self = this

  var args = {
    issueAddress: publicKey.getAddress(self.network).toString(),
    amount: 1,
    reissueable: true,
    divisibility: 0,
    transfer: [{
      address: toAddress,
      amount: 1
    }],
    metadata: {
      urls: [],
      assetName: self.companyName + ' access token',
      issuer: self.companyName,
      description: 'Access token for user ' + username + ' to ' + self.companyName + '.',
      userData: {
        meta: [
          {
            key: 'username',
            value: username,
            type: 'String'
          },
          {
            key: 'type',
            value: 'AccessToken',
            type: 'String'
          }
        ]
      }
    }
  }

  if (self.issuerHomepage) {
    args.metadata.urls.push({
      name: 'Issuer Homepage',
      url: self.issuerHomepage,
      mimeType: 'text/html'
    })
  }

  if (self.companyIcon) {
    args.metadata.urls.push({
      name: 'icon',
      url: self.companyIcon,
      mimeType: self.companyIconMIMEType,
      dataHash: self.companyIconDataHash
    })
  }

  self.colu.issueAsset(args, callback)
}

ColuAccess.prototype.verifyUser = function (username, assetId, callback) {
  var self = this

  assert(username, 'Need username as first argument.')
  assert(assetId, 'Need assetId as second argument.')
  assert.equal(typeof callback, 'function', 'Need callback function as last argument.')

  var data_params = self.createRegistrationMessage(username)
  data_params.asset_id = assetId
  request.post(self.coluHost + '/verify_asset_holdings',
    {json: data_params },
    function (err, response, body) {
      if (err) {
        return callback(err)
      }
      if (response.statusCode !== 200) {
        return callback(body)
      }
      assert('client_public_key' in body, 'No client_public_key return from server.')
      assert('verified_client_signature' in body, 'No verified_client_signature return from server.')
      if (verifyMessage(data_params, body.verified_client_signature, body.client_public_key, body.verified, body.client_message_str)) {
        return callback(null, body)
      } else {
        callback('signature not verified')
      }
    }
  )
}

ColuAccess.getUsername = function (registrationMessage) {
  assertRegistrationMessage(registrationMessage)
  var message = registrationMessage.message
  message = JSON.parse(message)
  var username = message.username
  return username
}

var verifyMessage = function (registrationMessage, clientSignature, clientPublicKey, verified, clientMessageStr, network) {
  var message = registrationMessage.message
  var signature = registrationMessage.signature
  var clientAddress = registrationMessage.client_address
  var clientMessage = {
    message: message,
    signature: signature,
    verified: verified
  }

  if (clientMessageStr) {
    clientMessage = JSON.parse(clientMessageStr)

    if (!(clientMessage.message === message) || !(clientMessage.signature === signature) || !(clientMessage.verified === verified)) {
      return false
    }
  } else {
    clientMessageStr = JSON.stringify(clientMessage)
  }

  var hash = crypto.createHash('sha256').update(clientMessageStr).digest()
  var publicKey = bitcoin.ECPubKey.fromHex(clientPublicKey)
  if (clientAddress) {
    return (publicKey.getAddress(network) === clientAddress) && ecdsa_verify(hash, clientSignature, publicKey)
  }
  return ecdsa_verify(hash, clientSignature, publicKey)
}

var parseRegistrationBody = function (body) {
  assert(body, 'Got error from server.')
  assert('extended_public_key' in body, 'No extended_public_key return from server.')
  assert('verified_client_signature' in body, 'No verified_client_signature return from server.')
  if (body && 'extended_public_key' in body) {
    return new User(body.extended_public_key)
  }
  return null
}

var assertRegistrationMessage = function (registrationMessage) {
  assert(registrationMessage, 'Need registrationMessage as first parameter, use createRegistrationMessage(username)')
  assert('message' in registrationMessage, 'registrationMessage not contains message, use createRegistrationMessage(username)')
  assert('company_public_key' in registrationMessage, 'registrationMessage not contains company_public_key, use createRegistrationMessage(username)')
  assert('signature' in registrationMessage, 'registrationMessage not contains signature, use createRegistrationMessage(username)')
  assert('company_name' in registrationMessage, 'registrationMessage not contains company_name, use createRegistrationMessage(username)')
}

var ecdsaSign = function (message, privateKey) {
  var shaMsg = crypto.createHash('sha256').update(message).digest()
  var signature = privateKey.sign(shaMsg)
  var signatureDER = signature.toDER()
  var signatureDERStr = signatureDER.toString('base64')
  return signatureDERStr
}

var ecdsa_verify = function (hash, signature, publicKey) {
  var sig_obj = bitcoin.ECSignature.fromDER(new Buffer(signature, 'base64'))
  var isValid = publicKey.verify(hash, sig_obj)
  return isValid
}

module.exports = ColuAccess
