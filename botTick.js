var _ = require('lodash');
var configs = require('./config.json');

module.exports = function (pokeio, myLocation) {
  var logNearbyPokemon = function (nearbyPokemon) {
    var pokemon = pokeio.pokemonlist[parseInt(nearbyPokemon.PokedexNumber) - 1]
    console.log(
      // '[+] There is a ' + pokemon.name + ' at ' + nearbyPokemon.DistanceMeters + ' meters'
    );
  };

  var catchWildPokemons = function (cell) {
    var pokeBallType = configs.canUseGreatBalls ? 2 : 1; //1 = pokeballs, 2 = greatballs, 3 = ultraball
    _.each(cell.WildPokemon, function (wildPokemon) {
      if (checkBlackList(configs.blackList, wildPokemon) === -1) {
        var pokedexInfo = pokeio.pokemonlist[parseInt(wildPokemon.pokemon.PokemonId) - 1];
        console.log('[+] There is a ' + pokedexInfo.name + ' near!! I can try to catch it!');

        pokeio.EncounterPokemon(wildPokemon, function (suc, dat) {
          console.log('Encountering pokemon ' + pokedexInfo.name + '...');
          pokeio.CatchPokemon(wildPokemon, 1, 1.950, 1, pokeBallType, function (xsuc, xdat) {
            var status = ['Unexpected error', 'Successful catch', 'Catch Escape', 'Catch Flee', 'Missed Catch'];
            if (xdat) {
              console.log('results are in ', status[xdat.status]);
            } else {
              console.log('might have run out of pokeballs', xdat);
            }
          });
        });
      }
    });
  };

  var moveAround = function () {
    if (configs.moveAround) {
      myLocation.coords.latitude += 0.0005;
      myLocation.coords.longitude += 0.0005;
      pokeio.SetLocation(myLocation, function () { console.log("I've moved."); });
    }
  };

  var checkBlackList = function (blackList, wildPokemon) {
    return _.findIndex(blackList, function (i) {
      return i === wildPokemon.pokemon.PokemonId;
    });
  };

  var releaseDuplicatePokemons = function () {
    pokeio.GetInventory(function (err, contents) {
      if (err) throw err;
      var pokemon = _.chain(contents.inventory_delta.inventory_items)
        .filter(function (i) {
          if (!i.inventory_item_data.pokemon) return false;
          if (!i.inventory_item_data.pokemon.pokemon_id) return false;
          return true;
        })
        .map(function (i) {
          return i.inventory_item_data.pokemon.toRaw();
        })
        .value();

      console.log('got inventory, parsing now', pokemon.length, '# of pokemon');

      // last step appends
      _.each(pokemon, function (pkm) {
        pkm.dupeCount = _.filter(pokemon, {
          'pokemon_id': pkm.pokemon_id
        });
        if (pkm.dupeCount.length > configs.dupeLimit) {
          pkm.dupeCount = _.sortBy(pkm.dupeCount, 'cp');
          _.each(pkm.dupeCount, function (pok, index) {
            if (index >= pkm.dupeCount.length - configs.dupeLimit) {
              return;
            } else {
              console.log('releasing pokemin', pok.pokemon_id, 'with cp ', pok.cp);
              pokeio.ReleasePokemon(pok.id, function (err, res) {
                if (err) {
                  console.log('err occured with releasing pokemon', err);
                }
                console.log(res);
              });
            }
          });
        }
      });

    });
  };

  var spinPokestops = function (cell) {
    _.each(cell.Fort, function (fort) {
      if (fort.FortType == 1 && fort.Enabled) {
        pokeio.GetFort(fort.FortId, fort.Latitude, fort.Longitude, function (err, fortresponse) {
          if (fortresponse) { // 1 = success
            if (fortresponse.result == 1) { // 1 = success
              // 2 = out of range ..
              console.log(fort.FortId + ' used!!');
            }
          }
        });
      }
    });
  };

  var botTick = function (err, hb) {
    if (err) { console.log('Error on botTick: ', err); }

    _.each(hb.cells, function (cell) {
      var nearbyPokemon = cell.NearbyPokemon[0];
      if (nearbyPokemon) { logNearbyPokemon(nearbyPokemon); }

      catchWildPokemons(cell);
      spinPokestops(cell);
    }); // end enumerating cells

    moveAround();
    if (configs.removeDupePokemon) {
      releaseDuplicatePokemons();
    }
  };

  return botTick;
};