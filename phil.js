'use strict';

var PokemonGO = require('./poke.io.js');

// using var so you can login with multiple users
var a = new PokemonGO.Pokeio();
var b = new PokemonGO.Pokeio();

//Set environment variables or replace placeholder text
var location = {
//    type: 'name',
//    name: process.env.PGO_LOCATION || 'Times Square'
    type: 'coords',
    coords: {
        latitude: 33.972964190413656,
        longitude: -118.42365790737779,
        altitude: 10
    }
};

var username = process.env.PGO_USERNAME || 'phil@acemobe.com';
var password = process.env.PGO_PASSWORD || 'Harvey71';
var provider = process.env.PGO_PROVIDER || 'google';

var target = null;
var moving = false;

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
        
        a.GetInventory(function (err, inventory)
        {
            if(err) {
                console.log(err);
            }
            
            if (inventory && inventory.inventory_delta)
            {
                for (var i = 0; i < inventory.inventory_delta.inventory_items.length; i++)
                {
                    var item = inventory.inventory_delta.inventory_items[i];
                    var inventory_item_data = item.inventory_item_data;
                    var item_count = inventory_item_data.item;
                    
                    // pokemon
                    if (inventory_item_data.pokemon)
                    {
                        
                    }
                    
//                    console.log (item_data);
                }
            }
        });

        setInterval(function(){
            if (moving)
            {
                return;
            }
            
            console.log('1[i] Current location: ' + a.playerInfo.locationName);
            console.log('1[i] lat/long/alt: : ' + a.playerInfo.latitude + ' ' + a.playerInfo.longitude + ' ' + a.playerInfo.altitude);

            a.Heartbeat(function(err,hb) {
                if(err) {
                    console.log(err);
                }
                
                for (var i = hb.cells.length - 1; i >= 0; i--) 
                {
                    if(hb.cells[i].NearbyPokemon[0]) 
                    {
                        var nearbyPokemon = hb.cells[i].NearbyPokemon[0];
                        var pokemon = a.pokemonlist[parseInt(nearbyPokemon.PokedexNumber)-1];
                        var encountedId = nearbyPokemon.EncounterId;
//                        console.log(nearbyPokemon)
                        
                        console.log('1[+] There is a ' + pokemon.name + ' at ' + nearbyPokemon.DistanceMeters.toString() + ' meters');
                    }

                    if(hb.cells[i].MapPokemon[0]) 
                    {
                        var mapPokemon = hb.cells[i].MapPokemon[0];
                        var pokemon = a.pokemonlist[parseInt(mapPokemon.PokedexTypeId)-1];
                        var encountedId = mapPokemon.EncounterId;
                        var time = mapPokemon.ExpirtationTimeMs;
//                        console.log(mapPokemon)
                        
                        console.log('1[+] There is a ' + pokemon.name + ' at ' + mapPokemon.Latitude.toString() + ", " + mapPokemon.Longitude.toString());

/*                        if (moving == false)
                        {
                            var dist = getDistanceFromLatLonInKm (a.playerInfo.latitude, a.playerInfo.longitude, mapPokemon.Latitude, mapPokemon.Longitude) * 1000;
                            
                            if (target == null)                        
                                target = [mapPokemon.Latitude, mapPokemon.Longitude, dist];
                            else if (dist < target[2])
                            {
                                target = [mapPokemon.Latitude, mapPokemon.Longitude, dist];
                            }
                        }
*/                    }

                    if(hb.cells[i].WildPokemon[0]) 
                    {
                        var wildPokemon = hb.cells[i].WildPokemon[0];
//                        console.log (wildPokemon);        
                    }
                    
                    if (hb.cells[i].Fort[0])
                    {
                        var fort = hb.cells[i].Fort[0];

                        // 1 = PokeStop
                        // 0 = GYM
                        if(fort.FortType == 1)
                        {   
                            var dist = getDistanceFromLatLonInKm (a.playerInfo.latitude, a.playerInfo.longitude, fort.Latitude, fort.Longitude) * 1000;

                            console.log('1[+] There is a PokeStop (' + fort.FortId + ') at ' + fort.Latitude.toString() + ", " + fort.Longitude.toString() + " - " + dist + ", " + fort.Enabled);

//{ 
//    result: 2,
//    items_awarded: [],
//    gems_awarded: null,
//    pokemon_data_egg: null,
//    experience_awarded: null,
//    cooldown_complete_timestamp_ms: null,
//    chain_hack_sequence_number: null 
//}
//{ 
//    result: 1,                                                                                                                                                                                                                                                                         
//    items_awarded:                                                                                                                                                                                                                                                                     
//    [ { item_id: 1, item_count: 1 },                                                                                                                                                                                                                                                  
//     { item_id: 1, item_count: 1 },                                                                                                                                                                                                                                                  
//     { item_id: 1, item_count: 1 } ],                                                                                                                                                                                                                                                
//    gems_awarded: null,                                                                                                                                                                                                                                                                
//    pokemon_data_egg: null,                                                                                                                                                                                                                                                            
//    experience_awarded: 50,                                                                                                                                                                                                                                                            
//    cooldown_complete_timestamp_ms: Long { low: 487711106, high: 342, unsigned: false },                                                                                                                                                                                               
//    chain_hack_sequence_number: 1 
//}    
                            if (fort.Enabled)
                            {
                                a.GetFortDetails(fort.FortId, fort.Latitude, fort.Longitude, function(err, fortresponse)
                                {
                                    if(err) {
                                        console.log(err);
                                    }
                                    
                                    console.log (fortresponse);
                                });                                
                                
                                console.log (fort);
                                var date = new Date();

                                if ((fort.CooldownCompleteMs == null || fort.CooldownCompleteMs < date.timeStamp) && moving == false)
                                {
                                    var dist = getDistanceFromLatLonInKm (a.playerInfo.latitude, a.playerInfo.longitude, fort.Latitude, fort.Longitude) * 1000;
                    
                                    if (dist > 10)
                                    {
                                        if (target == null)                        
                                            target = [fort.Latitude, fort.Longitude, dist];
                                        else if (dist < target[2])
                                        {
                                            target = [fort.Latitude, fort.Longitude, dist];
                                        }
                                    }
                                    else
                                    {
                                        a.GetFort(fort.FortId, fort.Latitude, fort.Longitude, function(err, fortresponse)
                                        {
                                            if(err) {
                                                console.log(err);
                                            }
                                            
                                            if(fortresponse.result == 1)
                                            {   
                                                // 1 = success
                                                // 2 = out of range ..
                                                console.log(fort.FortId + " used!!");
                                            }
                                        });
                                    }
                                }
                            }
                        }                   
                        else
                        {
                            console.log('1[+] There is a Gym (' + fort.FortId + ') at ' + fort.Latitude.toString() + ", " + fort.Longitude.toString() + ' owned by ' + fort.Team);
                        }
                    }
                }
                
                if (target != null)
                {
                    moving = true;
                    console.log ("moving to: " + target[0] + ", " + target[1]);
                }
            });
        }, 10000);

        setInterval(function(){
            if (target != null && moving)
            {
                var dist = getDistanceFromLatLonInKm (a.playerInfo.latitude, a.playerInfo.longitude, target[0], target[1]) * 1000;
                
                // move towards if greater then 40 meters
                if (dist > 8)
                {
                    var moveDistance = 5;
                    var nextWaypointBearing = DegreeBearing(a.playerInfo.latitude, a.playerInfo.longitude, target[0], target[1]);
                    var pos = CreateWaypoint(a.playerInfo.latitude, a.playerInfo.longitude, moveDistance, nextWaypointBearing);
                    
                    var location = {
                        type: 'coords',
                        coords: {
                            latitude: pos[0],
                            longitude: pos[1],
                            altitude: 10
                        }
                    };

                    a.SetLocation(location, function (err, loc) {
                        if (err) {
                        }
                        
                        console.log('1[i] Current location: ' + a.playerInfo.locationName);
                        console.log('1[i] lat/long/alt: : ' + a.playerInfo.latitude + ' ' + a.playerInfo.longitude + ' ' + a.playerInfo.altitude);
                    });
                }
                else
                {
                    moving = false;
                    target = null;
                }
            }
        }, 1000);
    });
});

function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

function CreateWaypoint(slat, slng, distanceInMeters, bearingDegrees)
{
    var distanceKm = distanceInMeters/1000.0;
    var distanceRadians = distanceKm/6371; //6371 = Earth's radius in km
    var bearingRadians = ToRad(bearingDegrees);
    var sourceLatitudeRadians = ToRad(slat);
    var sourceLongitudeRadians = ToRad(slng);

    var targetLatitudeRadians = Math.asin(Math.sin(sourceLatitudeRadians)*Math.cos(distanceRadians)
                                          +
                                          Math.cos(sourceLatitudeRadians)*Math.sin(distanceRadians)*
                                          Math.cos(bearingRadians));

    var targetLongitudeRadians = sourceLongitudeRadians + Math.atan2(Math.sin(bearingRadians)
                                                                     *Math.sin(distanceRadians)*
                                                                     Math.cos(sourceLatitudeRadians),
        Math.cos(distanceRadians)
        - Math.sin(sourceLatitudeRadians)*Math.sin(targetLatitudeRadians));

    // adjust toLonRadians to be in the range -180 to +180...
    targetLongitudeRadians = (targetLongitudeRadians + 3*Math.PI)%(2*Math.PI) - Math.PI;

    var ret = [ToDegrees(targetLatitudeRadians), ToDegrees(targetLongitudeRadians)];
    return ret;
}

function DegreeBearing(slat, slng, tlat, tlng)
{
    var dLon = ToRad(tlng - slng);
    var dPhi = Math.log(
        Math.tan(ToRad(tlat)/2 + Math.PI/4)/
        Math.tan(ToRad(slat)/2 + Math.PI/4));
    if (Math.abs(dLon) > Math.PI)
        dLon = dLon > 0 ? -(2*Math.PI - dLon) : 2*Math.PI + dLon;
        
    return ToBearing(Math.atan2(dLon, dPhi));
}

function ToBearing(radians)
{
    // convert radians to degrees (as bearing: 0...360)
    return (ToDegrees(radians) + 360)%360;
}

function ToDegrees(radians)
{
    return radians*180/Math.PI;
}

function ToRad(degrees)
{
    return degrees*(Math.PI/180);
}