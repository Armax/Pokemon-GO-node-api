'use strict';

var test = require('tape');

var Pokeio = require('../../poke.io.js');
var pokeio = new Pokeio.Pokeio();

var latitude = 40.759011;
var longitude = -73.9844722;

pokeio.playerInfo.latitude = latitude;
pokeio.playerInfo.longitude = longitude;

test('poke.io.GetLocationCoords', function (t) {
    t.plan(3);

    var coords = pokeio.GetLocationCoords();

    t.equal(coords.latitude, latitude, 'Returned exprected latitude');
    t.equal(coords.longitude, longitude, 'Returned exprected longitude');
    t.equal(coords.altitude, 0, 'Returned exprected altitude');
});
