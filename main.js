var Pokeio = require('./poke.io')

Pokeio.playerInfo.latitude = 42.0395926
Pokeio.playerInfo.longitude = 60.0266575

Pokeio.GetLocation(function(loc) {
    console.log('[i] Current location: ' + loc)
});

Pokeio.GetAccessToken("Arm4x","asd", function(token) {
    Pokeio.GetApiEndpoint(token, function(asd) {

    });
})
