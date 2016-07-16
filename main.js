var Pokeio = require('./poke.io')

// Google login in progress

Pokeio.GetAccessToken("Arm4x","pass", function(token) {
    Pokeio.GetApiEndpoint(token, function(asd) {

    });
})
