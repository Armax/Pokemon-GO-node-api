'use strict';

var test = require('tape');

var Pokeio = require('../../poke.io.js');
var pokeio = new Pokeio.Pokeio();

var latitude = 40.759011;
var longitude = -73.9844722;

pokeio.playerInfo.latitude = latitude;
pokeio.playerInfo.longitude = longitude;

test('poke.io.GetLocation', function (t) {
    t.plan(2);

    pokeio.GetLocation(function(err, address) {
        t.error(err, 'No error returned');

        t.equal(address, '191 Broadway, New York, NY 10036, USA', 'Returned exprected address');
    });
});
