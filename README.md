# Colu-Access
[![Build Status](https://travis-ci.org/Colu-platform/colu-access.svg?branch=master)](https://travis-ci.org/Colu-platform/colu-access) [![Coverage Status](https://coveralls.io/repos/Colu-platform/colu-access/badge.svg?branch=master)](https://coveralls.io/r/Colu-platform/colu-access?branch=master) [![npm version](https://badge.fury.io/js/colu-access.svg)](http://badge.fury.io/js/colu)

### Installation

```sh
$ npm i colu-access
```


### Constructor

```js
var ColuAccess = require('colu-access')

var coluAccess = new ColuAccess({
    companyName: 'optional',
    companyIcon: 'optional',
    companyIconMIMEType: 'optional',
    companyIconDataHash: 'optional',
    issuerHomepage: 'optional',
    coloredCoinsHost: 'optional',
    coluHost: 'optional',
    redisPort: 'optional',
    redisHost: 'optional',
    network:: 'optional',
    privateSeed: 'optional'
})
```

### API's

```js
ColuAccess.prototype.init(cb)
ColuAccess.prototype.createRegistrationMessage(username, account)
ColuAccess.prototype.createRegistrationQR(registrationMessage)
ColuAccess.prototype.getRegistrationQR(registrationMessage, callback)
ColuAccess.prototype.registerUser(args, callback)
ColuAccess.prototype.accessIssue(publicKey, toAddress, username, callback)
ColuAccess.prototype.verifyUser(username, assetId, callback)
```

### Testing

```sh
$ mocha
```
