'use strict';

function _toConsumableArray(arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
      arr2[i] = arr[i];
    }
    return arr2;
  } else {
    return Array.from(arr);
  }
}

var crypto = require('crypto');
var request = require('request');
var geocoder = require('geocoder');
var events = require('events');
var ProtoBuf = require('protobufjs');
var GoogleOAuth = require('gpsoauthnode');
var fs = require('fs');
var S2 = require('s2-geometry').S2;

var Logins = require('./logins');

var pogoSignature = require('node-pogo-signature');

var builder = ProtoBuf.loadProtoFile('pokemon.proto');
if (builder === null) {
  builder = ProtoBuf.loadProtoFile(__dirname + '/pokemon.proto');
}

var pokemonProto = builder.build();

var RequestEnvelop = pokemonProto.RequestEnvelop;
var ResponseEnvelop = pokemonProto.ResponseEnvelop;
var Signature = pokemonProto.Signature;
var pokemonlist = JSON.parse(fs.readFileSync(__dirname + '/pokemons.json', 'utf8'));
var itemlist = JSON.parse(fs.readFileSync(__dirname + '/items.json', 'utf8'));

var EventEmitter = events.EventEmitter;

var api_url = 'https://pgorelease.nianticlabs.com/plfe/rpc';

function GetCoords(self) {
  var _self$playerInfo = self.playerInfo;
  var latitude = _self$playerInfo.latitude;
  var longitude = _self$playerInfo.longitude;

  return [latitude, longitude];
}

function getNeighbors(lat, lng) {
  var level = 15;
  var origin = S2.latLngToKey(lat, lng, level);
  var walk = [ S2.keyToId(origin) ];
  // 10 before and 10 after
  var next = S2.nextKey(origin);
  var prev = S2.prevKey(origin);
  for (var i = 0; i < 10; i++) {
    // in range(10):
    walk.push(S2.toId(prev));
    walk.push(S2.toId(next));
    next = S2.nextKey(next);
    prev = S2.prevKey(prev);
  }
  return walk;
}

function Pokeio() {
  var self = this;
  self.events = new EventEmitter();
  self.j = request.jar();
  self.request = request.defaults({
    jar: self.j
  });

  self.google = new GoogleOAuth();

  self.pokemonlist = pokemonlist.pokemon;
  self.itemlist = itemlist.items;

  self.playerInfo = {
    accessToken: '',
    debug: true,
    latitude: 0,
    longitude: 0,
    altitude: 0,
    locationName: '',
    provider: '',
    apiEndpoint: '',
    device_info: null
  };

  self.DebugPrint = function (str) {
    if (self.playerInfo.debug === true) {
      //self.events.emit('debug',str)
      console.log(str);
    }
  };

  function api_req(api_endpoint, access_token, req, callback) {
    // Auth
    var authInfo = new RequestEnvelop.AuthInfo({
      provider: self.playerInfo.provider,
      token: new RequestEnvelop.AuthInfo.JWT(access_token, 59)
    });


    //console.log(req);

    var f_req = new RequestEnvelop({
      unknown1: 2,
      rpc_id: 1469378659230941192,

      requests: req,

      latitude: self.playerInfo.latitude,
      longitude: self.playerInfo.longitude,
      altitude: self.playerInfo.altitude,

      unknown12: 989
    });

    if (self.playerInfo.authTicket) {
      f_req.auth_ticket = self.playerInfo.authTicket;

      var lat = self.playerInfo.latitude, lng = self.playerInfo.longitude, alt = self.playerInfo.altitude;
      var authTicketEncoded = self.playerInfo.authTicket.encode().toBuffer();

      var signature = new Signature({
        location_hash1: pogoSignature.utils.hashLocation1(authTicketEncoded, lat, lng, alt).toNumber(),
        location_hash2: pogoSignature.utils.hashLocation2(lat, lng, alt).toNumber(),
        unk22: crypto.randomBytes(32),
        timestamp: new Date().getTime(),
        timestamp_since_start: (new Date().getTime() - self.playerInfo.initTime),
      });

      if (!Array.isArray(req)) {
        req = [req];
      }

      req.forEach(function(request) {
        var reqHash = pogoSignature.utils.hashRequest(authTicketEncoded, request.encode().toBuffer()).toString();
        var hash = require('long').fromString(reqHash, true, 10);
        signature.request_hash.push(hash);
      });

      // Simulate real device
      // add  condition
      if( self.playerInfo.device_info !== null ) {
          signature.device_info = new Signature.DeviceInfo({
            device_id: self.playerInfo.device_info.device_id,
            android_board_name: self.playerInfo.device_info.android_board_name,
            android_bootloader: self.playerInfo.device_info.android_bootloader,
            device_brand: self.playerInfo.device_info.device_brand,
            device_model: self.playerInfo.device_info.device_model,
            device_model_identifier: self.playerInfo.device_info.device_model_identifier,
            device_model_boot: self.playerInfo.device_info.device_model_boot,
            hardware_manufacturer: self.playerInfo.device_info.hardware_manufacturer,
            hardware_model: self.playerInfo.device_info.hardware_model,
            firmware_brand: self.playerInfo.device_info.firmware_brand,
            firmware_tags: self.playerInfo.device_info.firmware_tags,
            firmware_type: self.playerInfo.device_info.firmware_type,
            firmware_fingerprint: self.playerInfo.device_info.firmware_fingerprint
          });
     }

      signature.location_fix = new Signature.LocationFix({
        provider: "network",
        timestamp_since_start: (new Date().getTime() - self.playerInfo.initTime),
        provider_status: 3,
        location_type: 1
      });

      var iv = crypto.randomBytes(32);

      pogoSignature.encrypt(signature.encode().toBuffer(), iv, function(err, signatureEnc) {
        f_req.unknown6 = new RequestEnvelop.Unknown6({
          unknown1: 6,
          unknown2: new RequestEnvelop.Unknown6.Unknown2({
            unknown1: signatureEnc
          })
        });
        compiledProtobuf(f_req);
      });

    } else {
      f_req.auth = authInfo;
      compiledProtobuf(f_req);
    }

    function compiledProtobuf(protobuf) {
      //console.log(JSON.stringify(protobuf))
      protobuf = f_req.encode().toBuffer();

      var options = {
        url: api_endpoint,
        body: protobuf,
        encoding: null,
        headers: {
          'User-Agent': 'Niantic App'
        }
      };

      self.request.post(options, function (err, response, body) {
        if (err) {
          return callback(new Error('Error'));
        }

        if (response === undefined || body === undefined) {
          console.error('[!] RPC Server offline');
          return callback(new Error('RPC Server offline'));
        }

        var f_ret;
        try {
          f_ret = ResponseEnvelop.decode(body);
        } catch (e) {
          if (e.decoded) {
            // Truncated
            console.warn(e);
            f_ret = e.decoded; // Decoded message with missing required fields
          }
        }

        if (f_ret) {
          if (f_ret.auth_ticket) {
            self.playerInfo.authTicket = f_ret.auth_ticket;
          }
          return callback(null, f_ret);
        } else {
          api_req(api_endpoint, access_token, req, callback);
        }
      });
    }
  }

  self.init = function (username, password, location, provider, callback) {
    if (provider !== 'ptc' && provider !== 'google') {
      return callback(new Error('Invalid provider'));
    }

    self.playerInfo.initTime = new Date().getTime();

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
        self.DebugPrint('[i] Received PTC access token!');
        callback(null, token);
      });
    } else {
      Logins.GoogleAccount(user, pass, self, function (err, token) {
        if (err) {
          return callback(err);
        }

        self.playerInfo.accessToken = token;
        self.DebugPrint('[i] Received Google access token!');
        callback(null, token);
      });
    }
  };

  self.GetApiEndpoint = function (callback) {
    var req = [new RequestEnvelop.Requests(2), new RequestEnvelop.Requests(126), new RequestEnvelop.Requests(4), new RequestEnvelop.Requests(129), new RequestEnvelop.Requests(5)];

    api_req(api_url, self.playerInfo.accessToken, req, function (err, f_ret) {
      if (err) {
        return callback(err);
      }
      var api_endpoint = 'https://' + f_ret.api_url + '/rpc';
      self.playerInfo.apiEndpoint = api_endpoint;
      self.DebugPrint('[i] Received API Endpoint: ' + api_endpoint);
      return callback(null, api_endpoint);
    });
  };

  self.GetInventory = function (callback) {
    var req = new RequestEnvelop.Requests(4);

    api_req(self.playerInfo.apiEndpoint, self.playerInfo.accessToken, req, function (err, f_ret) {
      if (err) {
        return callback(err);
      }
      var dErr, inventory;
      try {
        inventory = ResponseEnvelop.GetInventoryResponse.decode(f_ret.payload[0]);
      } catch (err) {
        dErr = err;
      }
      callback(dErr, inventory);
    });
  };

  self.GetProfile = function (callback) {
    var req = new RequestEnvelop.Requests(2);
    api_req(self.playerInfo.apiEndpoint, self.playerInfo.accessToken, req, function (err, f_ret) {
      if (err) {
        return callback(err);
      }

      var dErr, response;
      try {
        response = ResponseEnvelop.ProfilePayload.decode(f_ret.payload[0]).profile;
      } catch (err) {
        dErr = err;
      }

      callback(dErr, response);

      if (response && response.username) {
        self.DebugPrint('[i] Logged in!');
      }

    });
  };

  self.GetJournal = function (callback) {
    var req = new RequestEnvelop.Requests(801);

    var _self$playerInfo6 = self.playerInfo;
    var apiEndpoint = _self$playerInfo6.apiEndpoint;
    var accessToken = _self$playerInfo6.accessToken;

    api_req(apiEndpoint, accessToken, req, function (err, f_ret) {
      if (err) {
        return callback(err);
      } else if (!f_ret || !f_ret.payload || !f_ret.payload[0]) {
        return callback('No result');
      }

      var dErr, journal;
      try {
        journal = ResponseEnvelop.ActionLogResponse.decode(f_ret.payload[0]);
      } catch (err) {
        dErr = err;
      }
      callback(dErr, journal);
    });
  };

  // IN DEVELPOMENT, YES WE KNOW IS NOT WORKING ATM
  self.Heartbeat = function (callback) {
    var _self$playerInfo2 = self.playerInfo;
    var apiEndpoint = _self$playerInfo2.apiEndpoint;
    var accessToken = _self$playerInfo2.accessToken;


    var nullbytes = new Array(21);
    nullbytes.fill(0);

    // Generating walk data using s2 geometry
    var walk = getNeighbors(self.playerInfo.latitude, self.playerInfo.longitude).sort(function (a, b) {
      return a > b;
    });

    // Creating MessageQuad for Requests type=106
    var walkData = new RequestEnvelop.MessageQuad({
      'f1': walk,
      'f2': nullbytes,
      'lat': self.playerInfo.latitude,
      'long': self.playerInfo.longitude
    });

    var req = [new RequestEnvelop.Requests(106, walkData.encode().toBuffer()), new RequestEnvelop.Requests(126), new RequestEnvelop.Requests(4, new RequestEnvelop.Unknown3(Date.now().toString()).encode().toBuffer()), new RequestEnvelop.Requests(129), new RequestEnvelop.Requests(5, new RequestEnvelop.Unknown3('54b359c97e46900f87211ef6e6dd0b7f2a3ea1f5').encode().toBuffer())];

    api_req(apiEndpoint, accessToken, req, function (err, f_ret) {
      if (err) {
        return callback(err);
      } else if (!f_ret || !f_ret.payload || !f_ret.payload[0]) {
        return callback('No result');
      }

      var dErr, heartbeat;
      try {
        heartbeat = ResponseEnvelop.HeartbeatPayload.decode(f_ret.payload[0]);
      } catch (err) {
        dErr = err;
      }
      callback(dErr, heartbeat);

    });
  };

  self.GetLocation = function (callback) {
    geocoder.reverseGeocode.apply(geocoder, _toConsumableArray(GetCoords(self)).concat([function (err, data) {
      if (data.status === 'ZERO_RESULTS') {
        return callback(new Error('location not found'));
      }

      callback(null, data.results[0].formatted_address);
    }]));
  };

  // Still WIP
  self.GetFortDetails = function (fortid, fortlat, fortlong, callback) {
    var fortDetailsMessage = new RequestEnvelop.FortDetailsRequest({
      'fort_id': fortid,
      'fort_latitude': fortlat,
      'fort_longitude': fortlong
    });

    var req = new RequestEnvelop.Requests(104, fortDetailsMessage.encode().toBuffer());

    api_req(self.playerInfo.apiEndpoint, self.playerInfo.accessToken, req, function (err, f_ret) {
      if (err) {
        return callback(err);
      } else if (!f_ret || !f_ret.payload || !f_ret.payload[0]) {
        return callback('No result');
      }

      var dErr, response;
      try {
        response = ResponseEnvelop.FortDetailsResponse.decode(f_ret.payload[0]);
      } catch (err) {
        dErr = err;
      }
      callback(dErr, response);
    });
  };

  // Still WIP
  self.GetFort = function (fortid, fortlat, fortlong, callback) {
    var fortSearchMessage = new RequestEnvelop.FortSearchMessage({
      'fort_id': fortid,
      'player_latitude': self.playerInfo.latitude,
      'player_longitude': self.playerInfo.longitude,
      'fort_latitude': fortlat,
      'fort_longitude': fortlong
    });

    var req = new RequestEnvelop.Requests(101, fortSearchMessage.encode().toBuffer());

    api_req(self.playerInfo.apiEndpoint, self.playerInfo.accessToken, req, function (err, f_ret) {
      if (err) {
        return callback(err);
      } else if (!f_ret || !f_ret.payload || !f_ret.payload[0]) {
        return callback('No result');
      }

      var dErr, response;
      try {
        response = ResponseEnvelop.FortSearchResponse.decode(f_ret.payload[0]);
      } catch (err) {
        dErr = err;
      }
      callback(dErr, response);
    });
  };

  self.EvolvePokemon = function (pokemonId, callback) {
    var _self$playerInfo3 = self.playerInfo;
    var apiEndpoint = _self$playerInfo3.apiEndpoint;
    var accessToken = _self$playerInfo3.accessToken;

    var evolvePokemon = new RequestEnvelop.EvolvePokemonMessage({
      'PokemonId': pokemonId
    });

    var req = new RequestEnvelop.Requests(125, evolvePokemon.encode().toBuffer());

    api_req(apiEndpoint, accessToken, req, function (err, f_ret) {
      if (err) {
        return callback(err);
      } else if (!f_ret || !f_ret.payload || !f_ret.payload[0]) {
        return callback('No result');
      }

      var dErr, response;
      try {
        response = ResponseEnvelop.EvolvePokemonResponse.decode(f_ret.payload[0]);
      } catch (err) {
        dErr = err;
      }
      callback(dErr, response);
    });
  };

  self.TransferPokemon = function (pokemonId, callback) {
    var _self$playerInfo3 = self.playerInfo;
    var apiEndpoint = _self$playerInfo3.apiEndpoint;
    var accessToken = _self$playerInfo3.accessToken;

    var transferPokemon = new RequestEnvelop.TransferPokemonMessage({
      'PokemonId': pokemonId
    });

    var req = new RequestEnvelop.Requests(112, transferPokemon.encode().toBuffer());

    api_req(apiEndpoint, accessToken, req, function (err, f_ret) {
      if (err) {
        return callback(err);
      } else if (!f_ret || !f_ret.payload || !f_ret.payload[0]) {
        return callback('No result');
      }

      var dErr, response;
      try {
        response = ResponseEnvelop.TransferPokemonResponse.decode(f_ret.payload[0]);
      } catch (err) {
        dErr = err;
      }
      callback(dErr, response);
    });
  };

  //still WIP
  self.CatchPokemon = function (mapPokemon, normalizedHitPosition, normalizedReticleSize, spinModifier, pokeball, callback) {
    var _self$playerInfo3 = self.playerInfo;
    var apiEndpoint = _self$playerInfo3.apiEndpoint;
    var accessToken = _self$playerInfo3.accessToken;

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
      } else if (!f_ret || !f_ret.payload || !f_ret.payload[0]) {
        return callback('No result');
      }

      var dErr, response;
      try {
        response = ResponseEnvelop.CatchPokemonResponse.decode(f_ret.payload[0]);
      } catch (err) {
        dErr = err;
      }
      callback(dErr, response);

    });
  };

  self.RenamePokemon = function(pokemonId, nickname, callback) {
    var renamePokemonMessage = new RequestEnvelop.NicknamePokemonMessage({
      'pokemon_id': pokemonId,
      'nickname': nickname,
    });

    var req = new RequestEnvelop.Requests(149, renamePokemonMessage.encode().toBuffer());

    var _self$playerInfo3 = self.playerInfo;
    var apiEndpoint = _self$playerInfo3.apiEndpoint;
    var accessToken = _self$playerInfo3.accessToken;

    api_req(apiEndpoint, accessToken, req, function (err, f_ret) {
      if (err) {
        return callback(err);
      } else if (!f_ret || !f_ret.payload || !f_ret.payload[0]) {
        return callback('No result');
      }

      var dErr, response;
      try {
        response = ResponseEnvelop.NicknamePokemonResponse.decode(f_ret.payload[0]);
      } catch (err) {
        dErr = err;
      }
      callback(dErr, response);
    });

  };

  self.EncounterPokemon = function (catchablePokemon, callback) {
    var _self$playerInfo4 = self.playerInfo;
    var apiEndpoint = _self$playerInfo4.apiEndpoint;
    var accessToken = _self$playerInfo4.accessToken;
    var latitude = _self$playerInfo4.latitude;
    var longitude = _self$playerInfo4.longitude;

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
      } else if (!f_ret || !f_ret.payload || !f_ret.payload[0]) {
        return callback('No result');
      }

      var dErr, response;
      try {
        response = ResponseEnvelop.EncounterResponse.decode(f_ret.payload[0]);
      } catch (err) {
        dErr = err;
      }
      callback(dErr, response);

    });
  };

  self.DropItem = function (itemId, count, callback) {
    var _self$playerInfo4 = self.playerInfo;
    var apiEndpoint = _self$playerInfo4.apiEndpoint;
    var accessToken = _self$playerInfo4.accessToken;
    var latitude = _self$playerInfo4.latitude;
    var longitude = _self$playerInfo4.longitude;

    var dropItemMessage = new RequestEnvelop.RecycleInventoryItemMessage({
      'item_id': itemId,
      'count': count
    });

    var req = new RequestEnvelop.Requests(137, dropItemMessage.encode().toBuffer());

    api_req(apiEndpoint, accessToken, req, function (err, f_ret) {
      if (err) {
        return callback(err);
      } else if (!f_ret || !f_ret.payload || !f_ret.payload[0]) {
        return callback('No result');
      }

      var dErr, response;
      try {
        response = ResponseEnvelop.RecycleInventoryItemResponse.decode(f_ret.payload[0]);
      } catch (err) {
        dErr = err;
      }
      callback(dErr, response);

    });
  };


  self.ReleasePokemon = function (pokemon, callback) {
    console.log(pokemon.toString());
    var releasePokemon = new RequestEnvelop.ReleasePokemonMessage({
      'pokemon_id': pokemon.toString()
    });
    var req = new RequestEnvelop.Requests(112, releasePokemon.encode().toBuffer());

    var _self$playerInfo3 = self.playerInfo;
    var apiEndpoint = _self$playerInfo3.apiEndpoint;
    var accessToken = _self$playerInfo3.accessToken;

    api_req(apiEndpoint, accessToken, req, function (err, f_ret) {
      if (err) {
        return callback(err);
      } else if (!f_ret || !f_ret.payload || !f_ret.payload[0]) {
        return callback('No result');
      }

      var dErr, response;
      try {
        response = ResponseEnvelop.ReleasePokemonResponse.decode(f_ret.payload[0]);
      } catch (err) {
        dErr = err;
      }
      callback(dErr, response);
    });

  };

  self.LevelUpRewards = function (level, callback) {

    var levelUpRewards = new RequestEnvelop.LevelUpRewardsMessage({
      'level': level
    });
    var req = new RequestEnvelop.Requests(128, levelUpRewards.encode().toBuffer());

    var _self$playerInfo3 = self.playerInfo;
    var apiEndpoint = _self$playerInfo3.apiEndpoint;
    var accessToken = _self$playerInfo3.accessToken;

    api_req(apiEndpoint, accessToken, req, function (err, f_ret) {
      if (err) {
        return callback(err);
      } else if (!f_ret || !f_ret.payload || !f_ret.payload[0]) {
        return callback('No result');
      }

      var dErr, response;
      try {
        response = ResponseEnvelop.LevelUpRewardsResponse.decode(f_ret.payload[0]);
      } catch (err) {
        dErr = err;
      }
      callback(dErr, response);
    });

  };

  self.UseItemEggIncubator = function (item_id, pokemonId, callback) {

    var levelUpRewards = new RequestEnvelop.UseItemEggIncubatorMessage({
      'item_id': item_id,
      'pokemonId': pokemonId
    });
    var req = new RequestEnvelop.Requests(140, levelUpRewards.encode().toBuffer());

    var _self$playerInfo3 = self.playerInfo;
    var apiEndpoint = _self$playerInfo3.apiEndpoint;
    var accessToken = _self$playerInfo3.accessToken;

    api_req(apiEndpoint, accessToken, req, function (err, f_ret) {
      if (err) {
        return callback(err);
      } else if (!f_ret || !f_ret.payload || !f_ret.payload[0]) {
        return callback('No result');
      }

      var dErr, response;
      try {
        response = ResponseEnvelop.UseItemEggIncubatorResponse.decode(f_ret.payload[0]);
      } catch (err) {
        dErr = err;
      }
      callback(dErr, response);
    });

  };


  self.GetHatchedEggs = function (callback) {

    var req = new RequestEnvelop.Requests(140);

    var _self$playerInfo3 = self.playerInfo;
    var apiEndpoint = _self$playerInfo3.apiEndpoint;
    var accessToken = _self$playerInfo3.accessToken;

    api_req(apiEndpoint, accessToken, req, function (err, f_ret) {
      if (err) {
        return callback(err);
      } else if (!f_ret || !f_ret.payload || !f_ret.payload[0]) {
        return callback('No result');
      }

      var dErr, response;
      try {
        response = ResponseEnvelop.GetHatchedEggsResponse.decode(f_ret.payload[0]);
      } catch (err) {
        dErr = err;
      }
      callback(dErr, response);
    });

  };

  self.UseItemXpBoost = function (itemId, count, callback) {

    var useItemXpBoostMessage = new RequestEnvelop.UseItemXpBoostMessage({
      'item_id': itemId,
    });

    var req = new RequestEnvelop.Requests(139, useItemXpBoostMessage.encode().toBuffer());

    var _self$playerInfo3 = self.playerInfo;
    var apiEndpoint = _self$playerInfo3.apiEndpoint;
    var accessToken = _self$playerInfo3.accessToken;

    api_req(apiEndpoint, accessToken, req, function (err, f_ret) {

      if (err) {
        return callback(err);
      } else if (!f_ret || !f_ret.payload || !f_ret.payload[0]) {
        return callback('No result');
      }
      var dErr, response;
      try {
        response = ResponseEnvelop.UseItemXpBoostResponse.decode(f_ret.payload[0]);
      } catch (err) {
        dErr = err;
      }
      callback(dErr, response);
    });
  };

  self.GetLocationCoords = function () {
    var _self$playerInfo5 = self.playerInfo;
    var latitude = _self$playerInfo5.latitude;
    var longitude = _self$playerInfo5.longitude;
    var altitude = _self$playerInfo5.altitude;

    return {
      latitude: latitude,
      longitude: longitude,
      altitude: altitude
    };
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

        var _data$results$0$geome = data.results[0].geometry.location;
        var lat = _data$results$0$geome.lat;
        var lng = _data$results$0$geome.lng;


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

      geocoder.reverseGeocode.apply(geocoder, _toConsumableArray(GetCoords(self)).concat([function (err, data) {
        if (err) return callback(err);
        if (data && data.status !== 'ZERO_RESULTS' && data.results && data.results[0]) {
          self.playerInfo.locationName = data.results[0].formatted_address;
        }

        callback(null, self.GetLocationCoords());
      }]));
    }
  };

  // Set device info for uk6
  self.SetDeviceInfo = function(devInfo) {
    self.playerInfo.device_info = devInfo;
  };

}

module.exports = new Pokeio();
module.exports.Pokeio = Pokeio;
