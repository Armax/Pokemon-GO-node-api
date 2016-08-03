'use strict';

var test = require('tape');

var Pokeio = require('../../poke.io.js');
var pokeio = new Pokeio.Pokeio();

var latitude = 40.759011;
var longitude = -73.9844722;

test('poke.io.SetLocation - fail to set type', function(t) {
    t.plan(2);

    var location = {};

    pokeio.SetLocation(location, function(err, coords) {
        t.equal(err.message, 'Invalid location type', 'Returned expected error');
        t.error(coords, 'Did not return coords, as expected');
    });
});

test('poke.io.SetLocation - name', function(t) {
    t.plan(4);

    var location = {
        type: 'name',
        name: 'Times square'
    };

    pokeio.SetLocation(location, function(err, coords) {
        t.error(err, 'No error returned');

        t.equal(coords.latitude, latitude, 'Returned expected latitude');
        t.equal(coords.longitude, longitude, 'Returned expected longitude');
        t.equal(coords.altitude, 0, 'Returned expected altitude');
    });
});

test('poke.io.SetLocation - fail to set location.name', function(t) {
    t.plan(2);

    var location = {
        type: 'name',
    };

    pokeio.SetLocation(location, function(err, coords) {
        t.equal(err.message, 'You should add a location name', 'Returned expected error');
        t.error(coords, 'Did not return coords, as expected');
    });
});

test('poke.io.SetLocation - coords', function(t) {
    t.plan(4);

    var location = {
        type: 'coords',
        coords: {
            latitude: latitude,
            longitude: longitude,
            altitude: 0
        }
    };

    pokeio.SetLocation(location, function(err, coords) {
        t.error(err, 'No error returned');

        t.equal(coords.latitude, latitude, 'Returned expected latitude');
        t.equal(coords.longitude, longitude, 'Returned expected longitude');
        t.equal(coords.altitude, 0, 'Returned expected altitude');
    });
});

test('poke.io.SetLocation - fail to set location.coords object', function(t) {
    t.plan(2);

    var location = {
        type: 'coords',
    };

    pokeio.SetLocation(location, function(err, coords) {
        t.equal(err.message, 'Coords object missing', 'Returned expected error');
        t.error(coords, 'Did not return coords, as expected');
    });
});
