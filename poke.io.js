'use strict';

const request = require('request');
const geocoder = require('geocoder');
const events = require('events');
const ProtoBuf = require('protobufjs');
const GoogleOAuth = require('gpsoauthnode');
const ByteBuffer = require('bytebuffer');

const s2 = require('s2geometry-node');
const Logins = require('./logins');

let builder = ProtoBuf.loadProtoFile('pokemon.proto');
if (builder === null) {
    builder = ProtoBuf.loadProtoFile(__dirname + '/pokemon.proto');
}

const pokemonProto = builder.build();
const {RequestEnvelop, ResponseEnvelop} = pokemonProto;

const EventEmitter = events.EventEmitter;

const api_url = 'https://pgorelease.nianticlabs.com/plfe/rpc';

function GetCoords(self) {
    let {latitude, longitude} = self.playerInfo;
    return [latitude, longitude];
};

function getNeighbors(lat, lng) {
    var origin = new s2.S2CellId(new s2.S2LatLng(lat, lng)).parent(15);
    var walk = [origin.id()];
    // 10 before and 10 after
    var next = origin.next();
    var prev = origin.prev();
    for (var i = 0; i < 10; i++) {
        // in range(10):
        walk.push(prev.id());
        walk.push(next.id());
        next = next.next();
        prev = prev.prev();
    }
    return walk;
}

function Pokeio() {
    var self = this;
    self.events = new EventEmitter();
    self.j = request.jar();
    self.request = request.defaults({jar: self.j});

    self.google = new GoogleOAuth();

    self.playerInfo = {
        accessToken: '',
        debug: true,
        latitude: 0,
        longitude: 0,
        altitude: 0,
        locationName: '',
        provider: '',
        apiEndpoint: ''
    };

    self.DebugPrint = function (str) {
        if (self.playerInfo.debug === true) {
            //self.events.emit('debug',str)
            console.log(str);
        }
    };

    function api_req(api_endpoint, access_token, req, callback) {
        // Auth
        var auth = new RequestEnvelop.AuthInfo({
            provider: self.playerInfo.provider,
            token: new RequestEnvelop.AuthInfo.JWT(access_token, 59)
        });

        var f_req = new RequestEnvelop({
            unknown1: 2,
            rpc_id: 1469378659230941192,

            requests: req,

            latitude: self.playerInfo.latitude,
            longitude: self.playerInfo.longitude,
            altitude: self.playerInfo.altitude,

            auth: auth,
            unknown12: 989
        });

        var protobuf = f_req.encode().toBuffer();

        var options = {
            url: api_endpoint,
            body: protobuf,
            encoding: null,
            headers: {
                'User-Agent': 'Niantic App'
            }
        };

        self.request.post(options, function (err, response, body) {
            if (response === undefined || body === undefined) {
                console.error('[!] RPC Server offline');
                return callback(new Error('RPC Server offline'));
            }

            try {
                var f_ret = ResponseEnvelop.decode(body);
            } catch (e) {
                if (e.decoded) { // Truncated
                    console.warn(e);
                    f_ret = e.decoded; // Decoded message with missing required fields
                }
            }

            if (f_ret) {
                return callback(null, f_ret);
            }
            else {
                api_req(api_endpoint, access_token, req, callback)
            }
        });

    }

    self.init = function (username, password, location, provider, callback) {
        if (provider !== 'ptc' && provider !== 'google') {
            return callback(new Error('Invalid provider'));
        }
        // set provider
        self.playerInfo.provider = provider;
        // Updating location
        self.SetLocation(location, function (err, loc) {
            if (err) {
                return callback(err);
            }
            // Getting access token
            self.GetAccessToken(username, password, function (err, token) {
                if (err) {
                    return callback(err);
                }
                // Getting api endpoint
                self.GetApiEndpoint(function (err, api_endpoint) {
                    if (err) {
                        return callback(err);
                    }
                    callback(null);
                });
            });
        });

    };

    self.GetAccessToken = function (user, pass, callback) {
        self.DebugPrint('[i] Logging with user: ' + user);
        if (self.playerInfo.provider === 'ptc') {
            Logins.PokemonClub(user, pass, self, function (err, token) {
                if (err) {
                    return callback(err);
                }

                self.playerInfo.accessToken = token;
                self.DebugPrint('[i] Received PTC access token!')
                callback(null, token);
            });
        } else {
            Logins.GoogleAccount(user, pass, self, function (err, token) {
                if (err) {
                    return callback(err);
                }

                self.playerInfo.accessToken = token;
                self.DebugPrint('[i] Received Google access token!')
                callback(null, token);
            });
        }
    };


    self.GetApiEndpoint = function (callback) {
        var req = [
            new RequestEnvelop.Requests(2),
            new RequestEnvelop.Requests(126),
            new RequestEnvelop.Requests(4),
            new RequestEnvelop.Requests(129),
            new RequestEnvelop.Requests(5)
        ];

        api_req(api_url, self.playerInfo.accessToken, req, function (err, f_ret) {
            if (err) {
                return callback(err);
            }
            var api_endpoint = `https://${f_ret.api_url}/rpc`;
            self.playerInfo.apiEndpoint = api_endpoint;
            self.DebugPrint('[i] Received API Endpoint: ' + api_endpoint);
            return callback(null, api_endpoint);
        });
    };

    self.GetInventory = function(callback) {
        var req = new RequestEnvelop.Requests(4);

        api_req(self.playerInfo.apiEndpoint, self.playerInfo.accessToken, req, function(err, f_ret){
            if(err){
                return callback(err);
            }
            var inventory = ResponseEnvelop.GetInventoryResponse.decode(f_ret.payload[0]);
            return callback(null, inventory);
        });
    };

    self.GetProfile = function (callback) {
        var req = new RequestEnvelop.Requests(2);
        api_req(self.playerInfo.apiEndpoint, self.playerInfo.accessToken, req, function (err, f_ret) {
            if (err) {
                return callback(err);
            }

            var profile = ResponseEnvelop.ProfilePayload.decode(f_ret.payload[0]).profile

            if (profile.username) {
                self.DebugPrint('[i] Logged in!');
            }
            callback(null, profile);
        });
    };

    // IN DEVELPOMENT, YES WE KNOW IS NOT WORKING ATM
    self.Heartbeat = function (callback) {
        let {apiEndpoint, accessToken} = self.playerInfo;

        let nullbytes = new Buffer(21);
        nullbytes.fill(0);

        // Generating walk data using s2 geometry
        var walk = getNeighbors(self.playerInfo.latitude, self.playerInfo.longitude).sort((a, b) => {
            return a > b;
        });
        var buffer = new ByteBuffer(21 * 10).LE();
        walk.forEach((elem) => {
            buffer.writeVarint64(elem);
        });

        // Creating MessageQuad for Requests type=106
        buffer.flip();
        var walkData = new RequestEnvelop.MessageQuad({
            'f1': buffer.toBuffer(),
            'f2': nullbytes,
            'lat': self.playerInfo.latitude,
            'long': self.playerInfo.longitude
        });

        var req = [
            new RequestEnvelop.Requests(106, walkData.encode().toBuffer()),
            new RequestEnvelop.Requests(126),
            new RequestEnvelop.Requests(4, (new RequestEnvelop.Unknown3(Date.now().toString())).encode().toBuffer()),
            new RequestEnvelop.Requests(129),
            new RequestEnvelop.Requests(5, (new RequestEnvelop.Unknown3('05daf51635c82611d1aac95c0b051d3ec088a930')).encode().toBuffer())
        ];

        api_req(apiEndpoint, accessToken, req, function (err, f_ret) {
            if (err) {
                return callback(err);
            }
            else if (!f_ret || !f_ret.payload || !f_ret.payload[0]) {
                return callback('No result');
            }

            var heartbeat = ResponseEnvelop.HeartbeatPayload.decode(f_ret.payload[0]);
            callback(null, heartbeat)
        });
    };

    self.GetLocation = function (callback) {
        geocoder.reverseGeocode(...GetCoords(self), function (err, data) {
            if (data.status === 'ZERO_RESULTS') {
                return callback(new Error('location not found'));
            }

            callback(null, data.results[0].formatted_address);
        });
    };

    //still WIP
    self.CatchPokemon = function (mapPokemon, normalizedHitPosition, normalizedReticleSize, spinModifier, pokeball, callback) {
        let {apiEndpoint, accessToken} = self.playerInfo;
        var catchPokemon = new RequestEnvelop.CatchPokemonMessage({
            'encounter_id': mapPokemon.EncounterId,
            'pokeball': pokeball,
            'normalized_reticle_size': normalizedReticleSize,
            'spawnpoint_id': mapPokemon.SpawnPointId,
            'hit_pokemon': true,
            'spin_modifier': spinModifier,
            'normalized_hit_position': normalizedHitPosition
        });

        var req = new RequestEnvelop.Requests(103, catchPokemon.encode().toBuffer());

        api_req(apiEndpoint, accessToken, req, function (err, f_ret) {
            if (err) {
                return callback(err);
            }
            else if (!f_ret || !f_ret.payload || !f_ret.payload[0]) {
                return callback('No result');
            }

            var catchPokemonResponse = ResponseEnvelop.CatchPokemonResponse.decode(f_ret.payload[0]);
            callback(null, catchPokemonResponse)
        });

    }

    self.EncounterPokemon = function (catchablePokemon, callback) {
        let {apiEndpoint, accessToken, latitude, longitude} = self.playerInfo;
        var encounterPokemon = new RequestEnvelop.EncounterMessage({
            'encounter_id': catchablePokemon.EncounterId,
            'spawnpoint_id': catchablePokemon.SpawnPointId,
            'player_latitude': latitude,
            'player_longitude': longitude
        });

        var req = new RequestEnvelop.Requests(102, encounterPokemon.encode().toBuffer());

        api_req(apiEndpoint, accessToken, req, function (err, f_ret) {
            if (err) {
                return callback(err);
            }
            else if (!f_ret || !f_ret.payload || !f_ret.payload[0]) {
                return callback('No result');
            }

            var catchPokemonResponse = ResponseEnvelop.EncounterResponse.decode(f_ret.payload[0]);
            callback(null, catchPokemonResponse)
        });

    }
    
    self.GetLocationCoords = function () {
        let {latitude, longitude, altitude} = self.playerInfo;
        return {latitude, longitude, altitude};
    };

    self.SetLocation = function (location, callback) {
        if (location.type !== 'name' && location.type !== 'coords') {
            return callback(new Error('Invalid location type'));
        }

        if (location.type === 'name') {
            if (!location.name) {
                return callback(new Error('You should add a location name'));
            }
            var locationName = location.name;
            geocoder.geocode(locationName, function (err, data) {
                if (err || data.status === 'ZERO_RESULTS') {
                    return callback(new Error('location not found'));
                }

                let {lat, lng} = data.results[0].geometry.location;

                self.playerInfo.latitude = lat;
                self.playerInfo.longitude = lng;
                self.playerInfo.locationName = locationName;

                callback(null, self.GetLocationCoords());
            });
        } else if (location.type === 'coords') {
            if (!location.coords) {
                return callback(new Error('Coords object missing'));
            }

            self.playerInfo.latitude = location.coords.latitude || self.playerInfo.latitude;
            self.playerInfo.longitude = location.coords.longitude || self.playerInfo.longitude;
            self.playerInfo.altitude = location.coords.altitude || self.playerInfo.altitude;

            geocoder.reverseGeocode(...GetCoords(self), function (err, data) {
                if (data.status !== 'ZERO_RESULTS') {
                    self.playerInfo.locationName = data.results[0].formatted_address;
                }

                callback(null, self.GetLocationCoords());
            });
        }
    };
}

module.exports = new Pokeio();
module.exports.Pokeio = Pokeio;
