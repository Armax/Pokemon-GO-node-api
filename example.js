var Pokeio = require('./poke.io')

var location = 'Stockflethsvej 39';

var username = 'Arm4x';
var password = 'OHSHITWADDUP';
var isGoogle = true;

var googleUsername = 'example@gmail.com';
var googlePassword = 'whatsappbrohhh';

Pokeio.SetLocation(location, function (err, loc) {
    if (err) throw err;

    console.log('[i] Current location: ' + location)
    console.log('[i] lat/long/alt: : ' + loc.latitude + ' ' + loc.longitude + ' ' + loc.altitude)

    if (isGoogle) {
        Pokeio.GetGoogleAccessToken(googleUsername, googlePassword, function (err, token) {
            if (err) throw err;

            Pokeio.GetApiEndpoint(function (err, api_endpoint) {
                if (err) throw err;

                Pokeio.GetProfile(function (err, profile) {
                    if (err) throw err;

                    console.log("[i] Username: " + profile.username)
                    console.log("[i] Poke Storage: " + profile.poke_storage)
                    console.log("[i] Item Storage: " + profile.item_storage)
                    if (profile.currency[0].amount == null) {
                        var poke = 0
                    } else {
                        var poke = profile.currency[0].amount
                    }
                    console.log("[i] Pokecoin: " + poke)
                    console.log("[i] Stardust: " + profile.currency[1].amount)
                })
            });
        });
    } else {
        Pokeio.GetAccessToken(username, password, function (err, token) {
            if (err) throw err;

            Pokeio.GetApiEndpoint(function (err, api_endpoint) {
                if (err) throw err;

                Pokeio.GetProfile(function (err, profile) {
                    if (err) throw err;

                    console.log("[i] Username: " + profile.username)
                    console.log("[i] Poke Storage: " + profile.poke_storage)
                    console.log("[i] Item Storage: " + profile.item_storage)
                    if (profile.currency[0].amount == null) {
                        var poke = 0
                    } else {
                        var poke = profile.currency[0].amount
                    }
                    console.log("[i] Pokecoin: " + poke)
                    console.log("[i] Stardust: " + profile.currency[1].amount)
                })
            });
        });
    }
});
