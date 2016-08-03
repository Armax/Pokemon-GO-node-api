'use strict';

var PokemonGO = require('./poke.io.js');

// using var so you can login with multiple users
var a = new PokemonGO.Pokeio();
var b = new PokemonGO.Pokeio();

//Set environment variables or replace placeholder text
var location = {
    type: 'name',
    name: process.env.PGO_LOCATION || 'Times Square'
};

var location1 = {
    type: 'name',
    name: process.env.PGO_LOCATION || 'Times Square'
};

var username = process.env.PGO_USERNAME || 'USER';
var password = process.env.PGO_PASSWORD || 'PASS';
var provider = process.env.PGO_PROVIDER || 'google';

var username1 = process.env.PGO_USERNAME || 'USER';
var password1 = process.env.PGO_PASSWORD || 'PASS';
var provider1 = process.env.PGO_PROVIDER || 'google';

a.init(username, password, location, provider, function(err) {
    if (err) throw err;

    console.log('1[i] Current location: ' + a.playerInfo.locationName);
    console.log('1[i] lat/long/alt: : ' + a.playerInfo.latitude + ' ' + a.playerInfo.longitude + ' ' + a.playerInfo.altitude);

    a.GetProfile(function(err, profile) {
        if (err) throw err;

        console.log('1[i] Username: ' + profile.username);
        console.log('1[i] Poke Storage: ' + profile.poke_storage);
        console.log('1[i] Item Storage: ' + profile.item_storage);

        var poke = 0;
        if (profile.currency[0].amount) {
            poke = profile.currency[0].amount;
        }

        console.log('1[i] Pokecoin: ' + poke);
        console.log('1[i] Stardust: ' + profile.currency[1].amount);

        setInterval(function(){
            a.Heartbeat(function(err,hb) {
                if(err) {
                    console.log(err);
                }

                for (var i = hb.cells.length - 1; i >= 0; i--) {
                    if(hb.cells[i].NearbyPokemon[0]) {
                        //console.log(a.pokemonlist[0])
                        var pokemon = a.pokemonlist[parseInt(hb.cells[i].NearbyPokemon[0].PokedexNumber)-1];
                        console.log('1[+] There is a ' + pokemon.name + ' at ' + hb.cells[i].NearbyPokemon[0].DistanceMeters.toString() + ' meters');
                    }
                }

            });
        }, 5000);

    });
});

b.init(username1, password1, location1, provider1, function(err) {
    if (err) throw err;

    console.log('[i] Current location: ' + b.playerInfo.locationName);
    console.log('[i] lat/long/alt: : ' + b.playerInfo.latitude + ' ' + b.playerInfo.longitude + ' ' + b.playerInfo.altitude);

    b.GetProfile(function(err, profile) {
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

        setInterval(function(){
            b.Heartbeat(function(err,hb) {
                if(err) {
                    console.log(err);
                }

                for (var i = hb.cells.length - 1; i >= 0; i--) {
                    if(hb.cells[i].NearbyPokemon[0]) {
                        //console.log(a.pokemonlist[0])
                        var pokemon = b.pokemonlist[parseInt(hb.cells[i].NearbyPokemon[0].PokedexNumber)-1];
                        console.log('[+] There is a ' + pokemon.name + ' at ' + hb.cells[i].NearbyPokemon[0].DistanceMeters.toString() + ' meters');
                    }
                }

                // Show MapPokemons (catchable) & catch
                for (i = hb.cells.length - 1; i >= 0; i--) {
                    for (var j = hb.cells[i].MapPokemon.length - 1; j >= 0; j--)
                    {   // use async lib with each or eachSeries should be better :)
                        var currentPokemon = hb.cells[i].MapPokemon[j];

                        (function(currentPokemon) {
                            var pokedexInfo = b.pokemonlist[parseInt(currentPokemon.PokedexTypeId)-1];
                            console.log('[+] There is a ' + pokedexInfo.name + ' near!! I can try to catch it!');

                            b.EncounterPokemon(currentPokemon, function(suc, dat) {
                                console.log('Encountering pokemon ' + pokedexInfo.name + '...');
                                b.CatchPokemon(currentPokemon, 1, 1.950, 1, 1, function(xsuc, xdat) {
                                    var status = ['Unexpected error', 'Successful catch', 'Catch Escape', 'Catch Flee', 'Missed Catch'];
                                    console.log(status[xdat.Status]);
                                });
                            });
                        })(currentPokemon);

                    }
                    }
            });
        }, 5000);

    });
});
