'use strict';

const request = require('request');
const geocoder = require('geocoder');
const events = require('events');
const ProtoBuf = require('protobufjs');
const GoogleOAuth = require('gpsoauthnode');

const Logins = require('./logins');

let builder = ProtoBuf.loadProtoFile('pokemon.proto');
if (builder === null) {
    builder = ProtoBuf.loadProtoFile('./node_modules/pokemon-go-node-api/pokemon.proto');
}

const pokemonProto = builder.build();
const {RequestEnvelop, ResponseEnvelop} = pokemonProto;

const EventEmitter = events.EventEmitter;

const api_url = 'https://pgorelease.nianticlabs.com/plfe/rpc';

function GetCoords(self) {
	let {latitude, longitude} = self.playerInfo;
	return [latitude, longitude];
};

function Pokeio() {
    var self = this;
    self.events = new EventEmitter();
    self.j = request.jar();
    self.request = request.defaults({ jar: self.j });

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

    self.DebugPrint = function(str) {
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

        self.request.post(options, function(err, response, body) {
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

            return callback(null, f_ret);
        });

    }

    self.init = function(username, password, location, provider, callback) {
        if (provider !== 'ptc' && provider !== 'google') {
            return callback(new Error('Invalid provider'));
        }
        // set provider
        self.playerInfo.provider = provider;
        // Updating location
        self.SetLocation(location, function(err, loc) {
            if (err) {
                return callback(err);
            }
            // Getting access token
            self.GetAccessToken(username, password, function(err, token) {
                if (err) {
                    return callback(err);
                }
                // Getting api endpoint
                self.GetApiEndpoint(function(err, api_endpoint) {
                    if (err) {
                        return callback(err);
                    }
                    callback(null);
                });
            });
        });

    };

    self.GetAccessToken = function(user, pass, callback) {
        self.DebugPrint('[i] Logging with user: ' + user);
        if (self.playerInfo.provider === 'ptc') {
            Logins.PokemonClub(user, pass, self, function(err, token) {
                if (err) {
                    return callback(err);
                }

                self.playerInfo.accessToken = token;
                self.DebugPrint('[i] Received PTC access token!')
                callback(null, token);
            });
        } else {
            Logins.GoogleAccount(user, pass, self, function(err, token) {
                if (err) {
                    return callback(err);
                }

                self.playerInfo.accessToken = token;
                self.DebugPrint('[i] Received Google access token!')
                callback(null, token);
            });
        }
    };


    self.GetApiEndpoint = function(callback) {
        var req = [
            new RequestEnvelop.Requests(2),
            new RequestEnvelop.Requests(126),
            new RequestEnvelop.Requests(4),
            new RequestEnvelop.Requests(129),
            new RequestEnvelop.Requests(5)
        ];

        api_req(api_url, self.playerInfo.accessToken, req, function(err, f_ret) {
            if (err) {
                return callback(err);
            }
            var api_endpoint = `https://${f_ret.api_url}/rpc`;
            self.playerInfo.apiEndpoint = api_endpoint;
            self.DebugPrint('[i] Received API Endpoint: ' + api_endpoint);
            callback(null, api_endpoint);
        });
    };

    self.GetProfile = function(callback) {
        var req = new RequestEnvelop.Requests(2);
        api_req(self.playerInfo.apiEndpoint, self.playerInfo.accessToken, req, function(err, f_ret) {
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

    self.GetPokemons = function(callback) {
        var nullbytes = new Buffer(21);
        nullbytes.fill(0);

        var mquad = new RequestEnvelop.MessageQuad(
                0,
                nullbytes,
                ...GetCoords(self)
        );

        var req = new RequestEnvelop.Requests(106, mquad);

        api_req(self.playerInfo.apiEndpoint, self.playerInfo.accessToken, req, function(err, f_ret) {
            if(err) {
                return callback(err);
            }
            console.log(f_ret);
            var pokemon = ResponseEnvelop.HeartbeatPayload.decode(f_ret.payload[0]);
            console.log(pokemon);
            callback(null, pokemon)
        });
    };

    self.Heartbeat = function(callback) {
		let {apiEndpoint, accessToken} = self.playerInfo;
        let nullbytes = new Buffer(21);
		nullbytes.fill(0);
        let mquad = new RequestEnvelop.MessageQuad(0, nullbytes, ...GetCoords(self));

        var req = [
            new RequestEnvelop.Requests(106, mquad),
            new RequestEnvelop.Requests(126),
            new RequestEnvelop.Requests(4, Date.now()),
            new RequestEnvelop.Requests(129),
            new RequestEnvelop.Requests(5, '05daf51635c82611d1aac95c0b051d3ec088a930')
        ];

        api_req(apiEndpoint, accessToken, req, function(err, f_ret) {
            if(err) {
                return callback(err);
            }
            console.log(f_ret);
            var pokemon = ResponseEnvelop.HeartbeatPayload.decode(f_ret.payload[0]);
            console.log(pokemon);
            callback(null, pokemon)
        });
    };

    self.GetLocation = function(callback) {
		geocoder.reverseGeocode(...GetCoords(self), function(err, data) {
            if (data.status === 'ZERO_RESULTS') {
                return callback(new Error('location not found'));
            }

            callback(null, data.results[0].formatted_address);
        });
    };

	self.GetLocationCoords = function() {
        let {latitude, longitude, altitude} = self.playerInfo;
        return {latitude, longitude, altitude};
    };

    self.SetLocation = function(location, callback) {
        if (location.type !== 'name' && location.type !== 'coords') {
            return callback(new Error('Invalid location type'));
        }

        if (location.type === 'name') {
            if (!location.name) {
                return callback(new Error('You should add a location name'));
            }
            var locationName = location.name;
            geocoder.geocode(locationName, function(err, data) {
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

            geocoder.reverseGeocode(...GetCoords(self), function(err, data) {
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
