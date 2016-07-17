'use strict';

var test = require('tape');

var Pokeio = require('../../poke.io.js');
var pokeio = new Pokeio.Pokeio();

var latitude = 40.4731191;
var longitude = -77.31329079999999;

pokeio.playerInfo.latitude = latitude;
pokeio.playerInfo.longitude = longitude;

test('poke.io.GetLocation', function (t) {
    t.plan(2);

    pokeio.GetLocation(function(err, address) {
        t.error(err, 'No error returned');

        t.equal(address, '355 Lyons Rd, Millerstown, PA 17062, USA', 'Returned exprected address');
    });
});
