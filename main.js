var Pokeio = require('./poke.io')

Pokeio.playerInfo.latitude = 62.0395926
Pokeio.playerInfo.longitude = 14.0266575

Pokeio.GetLocation(function(loc) {
    console.log('[i] Current location: ' + loc)
});

Pokeio.GetAccessToken("Arm4x","OHSHITWADDUP", function(token) {
    Pokeio.GetApiEndpoint(function(api_endpoint) {
        Pokeio.GetProfile(function(profile) {
            console.log("[i] Username: " + profile.username)
            console.log("[i] Poke Storage: " + profile.poke_storage)
            console.log("[i] Item Storage: " + profile.item_storage)
            if(profile.currency[0].amount == null) {
                var poke = 0
            }
            else {
                var poke = profile.currency[0].amount
            }
            console.log("[i] Pokecoin: " +  poke)
            console.log("[i] Stardust: " + profile.currency[1].amount)
        })
    });
})
