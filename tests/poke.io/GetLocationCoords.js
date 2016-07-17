'use strict';

var test = require('tape');

var Pokeio = require('../../poke.io.js');
var pokeio = new Pokeio.Pokeio();

var latitude = 40.4731191;
var longitude = -77.31329079999999;

pokeio.playerInfo.latitude = latitude;
pokeio.playerInfo.longitude = longitude;

test('poke.io.GetLocationCoords', function (t) {
    t.plan(3);

    var coords = pokeio.GetLocationCoords();

    t.equal(coords.latitude, latitude, 'Returned exprected latitude');
    t.equal(coords.longitude, longitude, 'Returned exprected longitude');
    t.equal(coords.altitude, 0, 'Returned exprected altitude');
});
