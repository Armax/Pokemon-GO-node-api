# Poke.io
Pokemon GO api node.js library, still WIP<br>
Check main.js for examples

## Installation & Usage:
```
npm install pokemon-go-node-api
```
```javascript
var Pokeio = require('pokemon-go-node-api')
```
Check [example.js](./example.js) for the result showed in the demo or check the documentation below.

## Demo:
![alt tag](http://cl.arm4x.net/poke2.png)

## Documentation:

Initializing Pokeio requires 3 method calls:
  1. Setting of geo location coords via SetLocation or SetLocationCoords
  2. Getting of access token via GetAccessToken
  3. Getting of api endpoint via GetApiEndpoint method

See the [example.js](./example.js).


### Pokeio.GetAccessToken(username, password, callback)

Will save the access token to the Pokeio internal state.

**Parameters**
  * `username {String}` Your pokemon trainer club username
  * `password {String}` Your pokemon trainer club password
  * `callback {Function(error, token)}`
    * `error {Error}`
    * `token {String}`

### Pokeio.GetApiEndpoint(callback)

Will save the api endpoint to the Pokeio internal state.

**Parameters**
  * `callback {Function(error, api_endpoint)}`
    * `error {Error}`
    * `api_endpoint {String}`

### Pokeio.GetProfile(callback)
**Parameters**
  * `callback {Function(error, profile)}`
    * `error {Error}`
    * `profile {Object}`
      * `creation_time {Numnber}`
      * `username {String}`
      * `team {Numnber}`
      * `tutorial {Numnber/Boolean}`
        * `poke_storage {String}`
        * `item_storage {String}`
        * `daily_bonus {Object}`
          * `NextCollectTimestampMs {Numnber}`
          * `NextDefenderBonusCollectTimestampMs {Numnber}`
        * `currency {Object}`
          * `type {String}`
          * `amount {Numnber}`

### Pokeio.GetLocation(callback)
Reads current latitude and longitude and returns a human readable address using the google maps api.

**Parameters**
  * `callback {Function(error, formatted_address)}`
    * `error {Error}`
    * `formatted_address {String}`

### Pokeio.GetLocationCoords()
**Returns**
  * `coordinates {Object}`
    * `latitude {Number}`
    * `longitude {Number}`
    * `altitude {Number}`

### Pokeio.SetLocation(locationName, callback)

Will save the cooridinates to the Pokeio internal state.

**Parameters**
  * `callback {Function(error, coordinates)}`
    * `error {Error}`
    * `coordinates {Object}`
      * `latitude {Number}`
      * `longitude {Number}`
      * `altitude {Number}`

### Pokeio.SetLocationCoords(coordinates)

Will save the cooridinates to the Pokeio internal state.

**Parameters**
  * `coordinates {Object}`
    * `latitude {Number}`
    * `longitude {Number}`
    * `altitude {Number}`

**Returns**
  * `coordinates {Object}`
    * `latitude {Number}`
    * `longitude {Number}`
    * `altitude {Number}`

## Thanks to:
Python demo: [tejado](https://github.com/tejado/pokemongo-api-demo) <br>

## Contact me
[@Arm4x](https://twitter.com/Arm4x)
Feel free to contact me for help or anything else
