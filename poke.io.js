var request = require('request')
var j = request.jar()
var request = request.defaults({jar:j})

var fs = require("fs");

var EventEmitter = require('events').EventEmitter

var api_url = 'https://pgorelease.nianticlabs.com/plfe/rpc'
var login_url = 'https://sso.pokemon.com/sso/login?service=https%3A%2F%2Fsso.pokemon.com%2Fsso%2Foauth2.0%2FcallbackAuthorize'
var login_oauth = 'https://sso.pokemon.com/sso/oauth2.0/accessToken'

var ProtoBuf = require("protobufjs");
var builder = ProtoBuf.loadProtoFile('pokemon.proto')
var pokemonProto = builder.build()
var RequestEnvelop = pokemonProto.RequestEnvelop
var ResponseEnvelop = pokemonProto.ResponseEnvelop

function Pokeio() {
    var self = this
    var events;
    self.events = new EventEmitter()

    var playerInfo = {
        'accessToken'       : '',
        'debug'             : true
    }

    function DebugPrint(str) {
        if(playerInfo.debug==true) {
            //self.events.emit('debug',str)
            console.log(str)
        }
    }

    function api_req(api_endpoint, access_token, req) {
        // Auth
        var auth = new RequestEnvelop.AuthInfo({
            "provider"  : "ptc",
            "token"     : new RequestEnvelop.AuthInfo.JWT(access_token,59)
        })

        var f_req = new RequestEnvelop({
            'unknown1'  : 2,
            'rpc_id'    : 8145806132888207460,

            'requests'  : req,

            'latitude'  : 45,
            'longitude' : 46,
            'altitude'  : 0,

            'auth'      : auth,
            'unknown12' : 989
        })

        var protobuf = f_req.encode().toBuffer()

        options = {
            url: api_endpoint,
            body: protobuf,
            encoding: null,
            headers: {
                'User-Agent': 'Niantic App'
            }
        };

        request.post(options, function(e, r, body) {
            console.log(r.body.toString())

            try {
                var msg = ResponseEnvelop.decode(r.body)
            } catch (e) {
                if (e.decoded) { // Truncated
                    console.log(e)
                    msg = e.decoded; // Decoded message with missing required fields
                }
            }
        });

    }

    self.GetAccessToken = function(user,pass,callback) {
        DebugPrint("[i] Logging with user: " + user)

        var options = {
          url: login_url,
          headers: {
            'User-Agent': 'niantic'
          }
        };

        request.get(options, function(e, r, body) {
            var data = JSON.parse(body)

            options = {
                url: login_url,
                form: {
                    'lt'        : data.lt,
                    'execution' : data.execution,
                    '_eventId'  : 'submit',
                    'username'  : user,
                    'password'  : pass
                },
                headers: {
                    'User-Agent': 'niantic'
                }
            };

            request.post(options, function(e, r, body) {
                var ticket = r.headers['location'].split("ticket=")[1]

                options = {
                    url: login_oauth,
                    form: {
                        'client_id'         : 'mobile-app_pokemon-go',
                        'redirect_uri'      : 'https://www.nianticlabs.com/pokemongo/error',
                        'client_secret'     : 'w8ScCUXJQc6kXKw8FiOhd8Fixzht18Dq3PEVkUCP5ZPxtgyWsbTvWHFLm2wNY0JR',
                        'grant_type'        : 'refresh_token',
                        'code'              : ticket
                    },
                    headers: {
                        'User-Agent': 'niantic'
                    }
                };

                request.post(options, function(e, r, body) {
                    var token = body.split("token=")[1]
                    token = token.split("&")[0]
                    DebugPrint("[i] Session token: " + token)
                    callback(token)
                });

            });

        });
    }


    self.GetApiEndpoint = function(access_token, callback) {
        var req = []
        req.push(
            new RequestEnvelop.Requests(2),
            new RequestEnvelop.Requests(126),
            new RequestEnvelop.Requests(4),
            new RequestEnvelop.Requests(129),
            new RequestEnvelop.Requests(5, new RequestEnvelop.Unknown3("4a2e9bc330dae60e7b74fc85b98868ab4700802e"))
        )

        api_req(api_url, access_token, req)
    }
}

module.exports = new Pokeio();
module.exports.Pokeio = Pokeio;
