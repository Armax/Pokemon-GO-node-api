'use strict';

const request = require('request');
const geocoder = require('geocoder');
const events = require('events');
const ProtoBuf = require('protobufjs');
const GoogleOAuth = require('gpsoauthnode');
const Long = require('long');
const ByteBuffer = require('bytebuffer');
const bignum = require('bignum');

const s2 = require('simple-s2-node');
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
    var origin = s2.S2CellId.from_lat_lng(s2.S2LatLng.from_degrees(lat, lng)).parent(15);
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

class Pokeio {
    constructor(){
		this.events = new EventEmitter();

		this.j = request.jar();
		this.request = request.defaults({jar: this.j});

		this.google = new GoogleOAuth();

		this.playerInfo = {
			accessToken: '',
			debug: true,
			latitude: 0,
			longitude: 0,
			altitude: 0,
			locationName: '',
			provider: '',
			apiEndpoint: ''
		};
	}

    DebugPrint(str) {
        if (this.playerInfo.debug === true) {
            console.log(str);
        }
    }

    api_req(api_endpoint, access_token, req, callback) {
        // Auth
        var auth = new RequestEnvelop.AuthInfo({
            provider: this.playerInfo.provider,
            token: new RequestEnvelop.AuthInfo.JWT(access_token, 59)
        });

        var f_req = new RequestEnvelop({
            unknown1: 2,
            rpc_id: 1469378659230941192,

            requests: req,

            latitude: this.playerInfo.latitude,
            longitude: this.playerInfo.longitude,
            altitude: this.playerInfo.altitude,

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

        this.request.post(options, (err, response, body) => {
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
                this.api_req(api_endpoint, access_token, req, callback)
            }
        });

    }

    init(username, password, location, provider, callback) {
        if (provider !== 'ptc' && provider !== 'google') {
            return callback(new Error('Invalid provider'));
        }
        // set provider
        this.playerInfo.provider = provider;
        // Updating location
        this.SetLocation(location, (err, loc) => {
            if (err) {
                return callback(err);
            }
            // Getting access token
            this.GetAccessToken(username, password, (err, token) => {
                if (err) {
                    return callback(err);
                }
                // Getting api endpoint
                this.GetApiEndpoint((err, api_endpoint) => {
                    if (err) {
                        return callback(err);
                    }
                    callback(null);
                });
            });
        });
    }

    GetAccessToken(user, pass, callback) {
        this.DebugPrint('[i] Logging with user: ' + user);
        if (this.playerInfo.provider === 'ptc') {
            Logins.PokemonClub(user, pass, this, (err, token) => {
                if (err) {
                    return callback(err);
                }

                this.playerInfo.accessToken = token;
                this.DebugPrint('[i] Received PTC access token!')
                callback(null, token);
            });
        } else {
            Logins.GoogleAccount(user, pass, this, (err, token) => {
                if (err) {
                    return callback(err);
                }

                this.playerInfo.accessToken = token;
                this.DebugPrint('[i] Received Google access token!')
                callback(null, token);
            });
        }
    }

    GetApiEndpoint(callback) {
        var req = [
            new RequestEnvelop.Requests(2),
            new RequestEnvelop.Requests(126),
            new RequestEnvelop.Requests(4),
            new RequestEnvelop.Requests(129),
            new RequestEnvelop.Requests(5)
        ];

        this.api_req(api_url, this.playerInfo.accessToken, req, (err, f_ret) => {
            if (err) {
                return callback(err);
            }
            var api_endpoint = `https://${f_ret.api_url}/rpc`;
            this.playerInfo.apiEndpoint = api_endpoint;
            this.DebugPrint('[i] Received API Endpoint: ' + api_endpoint);
            return callback(null, api_endpoint);
        });
    }

    GetInventory(callback) {
        var req = new RequestEnvelop.Requests(4);

        this.api_req(this.playerInfo.apiEndpoint, this.playerInfo.accessToken, req, (err, f_ret) => {
            if(err){
                return callback(err);
            }
            var inventory = ResponseEnvelop.GetInventoryResponse.decode(f_ret.payload[0]);
            return callback(null, inventory);
        });
    }

    GetProfile(callback) {
        var req = new RequestEnvelop.Requests(2);
        this.api_req(this.playerInfo.apiEndpoint, this.playerInfo.accessToken, req, (err, f_ret) => {
            if (err) {
                return callback(err);
            }

            var profile = ResponseEnvelop.ProfilePayload.decode(f_ret.payload[0]).profile

            if (profile.username) {
                this.DebugPrint('[i] Logged in!');
            }
            callback(null, profile);
        });
    }

    // IN DEVELPOMENT, YES WE KNOW IS NOT WORKING ATM
    Heartbeat(callback) {
        let {apiEndpoint, accessToken} = this.playerInfo;

        let nullbytes = new Buffer(21);
        nullbytes.fill(0);

        // Generating walk data using s2 geometry
        var walk = getNeighbors(this.playerInfo.latitude, this.playerInfo.longitude).sort((a, b) => {
            return a.cmp(b);
        });
        var buffer = new ByteBuffer(21 * 10).LE();
        walk.forEach((elem) => {
            buffer.writeVarint64(s2.S2Utils.long_from_bignum(elem));
        });

        // Creating MessageQuad for Requests type=106
        buffer.flip();
        var walkData = new RequestEnvelop.MessageQuad({
            f1: buffer.toBuffer(),
            f2: nullbytes,
            lat: this.playerInfo.latitude,
            long: this.playerInfo.longitude
        });

        var req = [
            new RequestEnvelop.Requests(106, walkData.encode().toBuffer()),
            new RequestEnvelop.Requests(126),
            new RequestEnvelop.Requests(4, (new RequestEnvelop.Unknown3(Date.now().toString())).encode().toBuffer()),
            new RequestEnvelop.Requests(129),
            new RequestEnvelop.Requests(5, (new RequestEnvelop.Unknown3('05daf51635c82611d1aac95c0b051d3ec088a930')).encode().toBuffer())
        ];

        this.api_req(apiEndpoint, accessToken, req, (err, f_ret) => {
            if (err) {
                return callback(err);
            }
            else if (!f_ret || !f_ret.payload || !f_ret.payload[0]) {
                return callback('No result');
            }

            var heartbeat = ResponseEnvelop.HeartbeatPayload.decode(f_ret.payload[0]);
            callback(null, heartbeat)
        });
    }

    GetLocation(callback) {
        geocoder.reverseGeocode(...GetCoords(this), (err, data) => {
            if (data.status === 'ZERO_RESULTS') {
                return callback(new Error('location not found'));
            }

            callback(null, data.results[0].formatted_address);
        });
    }

    GetLocationCoords() {
        let {latitude, longitude, altitude} = this.playerInfo;
        return {latitude, longitude, altitude};
    }

    SetLocation(location, callback) {
        if (location.type !== 'name' && location.type !== 'coords') {
            return callback(new Error('Invalid location type'));
        }

        if (location.type === 'name') {
            if (!location.name) {
                return callback(new Error('You should add a location name'));
            }
            var locationName = location.name;
            geocoder.geocode(locationName, (err, data) => {
                if (err || data.status === 'ZERO_RESULTS') {
                    return callback(new Error('location not found'));
                }

                let {lat, lng} = data.results[0].geometry.location;

                this.playerInfo.latitude = lat;
                this.playerInfo.longitude = lng;
                this.playerInfo.locationName = locationName;

                callback(null, this.GetLocationCoords());
            });
        } else if (location.type === 'coords') {
            if (!location.coords) {
                return callback(new Error('Coords object missing'));
            }

            this.playerInfo.latitude = location.coords.latitude || this.playerInfo.latitude;
            this.playerInfo.longitude = location.coords.longitude || this.playerInfo.longitude;
            this.playerInfo.altitude = location.coords.altitude || this.playerInfo.altitude;

            geocoder.reverseGeocode(...GetCoords(this), (err, data) => {
                if (data.status !== 'ZERO_RESULTS') {
                    this.playerInfo.locationName = data.results[0].formatted_address;
                }

                callback(null, this.GetLocationCoords());
            });
        }
    }
}

module.exports = new Pokeio();
module.exports.Pokeio = Pokeio;
