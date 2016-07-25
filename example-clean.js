//
// this performs one single heartbeat, in most cases you will
// want to do this at interval or after a SetLocation
//

var PokemonGO = require('./poke.io.js');
var _ = require('lodash');
var async = require('async');

var location = {
  type: 'name',
  name: process.env.PGO_LOCATION || 'Times Square'
};
var username = process.argv[2] || process.env.PGO_USERNAME || 'USER';
var password = process.argv[3] || process.env.PGO_PASSWORD || 'PASS';
var provider = process.argv[4] || process.env.PGO_PROVIDER || 'google';

var trainer = new PokemonGO.Pokeio();

trainer.init(username, password, location, 'ptc', function (err) {
  if (err) throw err;

  console.log('[i] Current location: ' + trainer.playerInfo.locationName);
  console.log('[i] lat/long/alt: : ' + trainer.playerInfo.latitude + ' ' + trainer.playerInfo.longitude + ' ' + trainer.playerInfo.altitude);

  trainer.Heartbeat(function (err, hb) {

    // build task list of things to do at this heartbeat (Location)
    async.series([

      //
      // scan available forts within cell
      //

      function (finishedTask) {
          // check forts syncronously call 'doneFort' when we are done with each
          async.eachSeries(hb.forts, function (fort, doneFort) {
            if (fort.inRange) {

              // swipe pokestop
              fort.GetFort(function (err, response) {
                if (err || !response.result) {
                  console.log('[!] ', err, response);
                }
                var status = ['Unexpected error', 'PokeStop Pillaged', 'Cant reach PokeStop', 'PokeStop Already Used'];
                console.log('[+] ' + status[response.result]);
                doneFort();
              });

            } else {
              // cant reach it, so dont bother.
              console.log('[-] Cant reach Pokestop');
              doneFort();
            }
          }, function () {
            console.log('[i] Pokestops done!');
            finishedTask(null, 'OK!');
          });

      },

      //
      // scan wild pokemon within cell
      //

      function (finishedTask) {

          // check wildpokemon syncronously call 'doneFort' when we are done with each
          async.eachSeries(hb.wildPokemon, function (pokemon, donePkm) {
            // some logic to decide whether or not to catch would go here.
            console.log('[i] A wild ' + pokemon.pokedexInfo.name + ' appeared!!');
            console.log('[i] Gunna catch it!!');
            pokemon.catchIt(function (err, response) {
              if (err) {
                console.log('Hard fail catch?', err);
                return donePkm();
              }
              var status = ['Unexpected error', 'Successful Catch!', 'Catch Escape', 'Catch Flee', 'Missed Catch'];
              console.log('[+] ' + status[response.Status] + ' ' + pokemon.pokedexInfo.name);
              donePkm();
            });

          }, function () {
            console.log('[i] WildPokemon done!');
            finishedTask(null, 'OK!');
          });
      }
    ],
      // optional callback
      function (err, results) {
        console.log(err, results);
      });
  });
});
