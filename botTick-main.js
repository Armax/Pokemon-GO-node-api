'use strict';

var PokemonGO = require('./poke.io.js');
var botTick = require('./botTick.js');
var configs = require('./config.json');

// using var so you can login with multiple users
var pokeio = new PokemonGO.Pokeio();
//Set environment variables or replace placeholder text
var location = configs.locations.centralParkNyc;

var username = process.env.PGO_USERNAME || configs.user1.username;
var password = process.env.PGO_PASSWORD || configs.user1.password;
var provider = process.env.PGO_PROVIDER || configs.user1.provider;

pokeio.init(username, password, location, provider, function(err) {
    if (err) throw err;
    var playerInfo = pokeio.playerInfo;
    console.log('[i] Current location: ' + playerInfo.locationName);
    console.log(
      '[i] lat/long/alt: : ' +
      playerInfo.latitude + ' ' + playerInfo.longitude + ' ' + playerInfo.altitude
    );

    pokeio.GetProfile(function(err, profile) {
        if (err) throw err;

        console.log('[i] Username: ' + profile.username);
        console.log('[i] Poke Storage: ' + profile.poke_storage);
        console.log('[i] Item Storage: ' + profile.item_storage);

        var poke = 0;
        if (profile.currency[0].amount) {
            poke = profile.currency[0].amount;
        }

        console.log('[i] Pokecoin: ' + poke);
        console.log('[i] Stardust: ' + profile.currency[1].amount);

        setInterval(function(){ pokeio.Heartbeat(botTick(pokeio, location)); }, 3000);

    });
});
