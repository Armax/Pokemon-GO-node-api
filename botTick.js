var _ = require("lodash")

module.exports = function(pokeio, myLocation){
  var logNearbyPokemon = function(nearbyPokemon){
    var pokemon = pokeio.pokemonlist[parseInt(nearbyPokemon.PokedexNumber) - 1]
    console.log(
      '[+] There is a ' + pokemon.name + ' at ' + nearbyPokemon.DistanceMeters + ' meters'
    )
  }

  var catchWildPokemons = function(cell){
    _.each(cell.WildPokemon, function(wildPokemon){
      var pokedexInfo = pokeio.pokemonlist[parseInt(wildPokemon.pokemon.PokemonId)-1]
      console.log('[+] There is a ' + pokedexInfo.name + ' near!! I can try to catch it!');

      pokeio.EncounterPokemon(wildPokemon, function(suc, dat) {
        console.log('Encountering pokemon ' + pokedexInfo.name + '...');
        pokeio.CatchPokemon(wildPokemon, 1, 1.950, 1, 1, function(xsuc, xdat) {
          // var status = ['Unexpected error', 'Successful catch', 'Catch Escape', 'Catch Flee', 'Missed Catch'];
          // console.log(status[xdat.Status]);
        });
      });
    })
  }

  var moveAround = function(){
    myLocation.coords.latitude += 0.0005;
    myLocation.coords.longitude += 0.0005;
    pokeio.SetLocation(myLocation, function(){ console.log("I've moved."); })
  }

  var botTick = function (err, hb) {
    if(err) { console.log("Error on botTick: ", err); }

    _.each(hb.cells, function(cell){
      nearbyPokemon = cell.NearbyPokemon[0];
      if(nearbyPokemon) { logNearbyPokemon(nearbyPokemon) }

      catchWildPokemons(cell);
    }) // end enumerating cells

    moveAround();
  }

  return botTick;
}
