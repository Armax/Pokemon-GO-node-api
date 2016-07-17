var login_url = 'https://sso.pokemon.com/sso/login?service=https%3A%2F%2Fsso.pokemon.com%2Fsso%2Foauth2.0%2FcallbackAuthorize'
var login_oauth = 'https://sso.pokemon.com/sso/oauth2.0/accessToken'
var ANDROID_ID = '9774d56d682e549c'
var SERVICE = 'audience:server:client_id:848232511240-7so421jotr2609rmqakceuu1luuq0ptb.apps.googleusercontent.com'
var APP = 'com.nianticlabs.pokemongo'
var CLIENT_SIG = '321187995bc7cdc2b5fc91b11a96e2baa8602c62'
module.exports = {
    PokemonClub: function (user, pass, self, callback) {
        var options = {
            url: login_url,
            headers: {
                'User-Agent': 'niantic'
            }
        };

        self.request.get(options, function (e, r, body) {
            var data = JSON.parse(body)

            options = {
                url: login_url,
                form: {
                    'lt': data.lt,
                    'execution': data.execution,
                    '_eventId': 'submit',
                    'username': user,
                    'password': pass
                },
                headers: {
                    'User-Agent': 'niantic'
                }
            };

            self.request.post(options, function (e, r, body) {
                //Parse body if any exists, callback with errors if any.
                if (body) {
                    var parsedBody = JSON.parse(body);
                    if (parsedBody.errors && parsedBody.errors.length !== 0) {
                        return callback(new Error('Error logging in: ' + parsedBody.errors[0]));
                    }
                }

                var ticket = r.headers['location'].split("ticket=")[1]

                options = {
                    url: login_oauth,
                    form: {
                        'client_id': 'mobile-app_pokemon-go',
                        'redirect_uri': 'https://www.nianticlabs.com/pokemongo/error',
                        'client_secret': 'w8ScCUXJQc6kXKw8FiOhd8Fixzht18Dq3PEVkUCP5ZPxtgyWsbTvWHFLm2wNY0JR',
                        'grant_type': 'refresh_token',
                        'code': ticket
                    },
                    headers: {
                        'User-Agent': 'niantic'
                    }
                };

                self.request.post(options, function (e, r, body) {
                    var token = body.split("token=")[1]
                    token = token.split("&")[0]

                    if (!token) {
                        return callback(new Error('Login failed'));
                    }

                    self.DebugPrint("[i] Session token: " + token)
                    callback(null, token)
                });

            });

        });
    },

    GoogleAccount: function (user, pass, self, callback) {
        self.google.login(user, pass, ANDROID_ID, function (err, data) {
            if (data) {
                self.google.oauth(user, data.masterToken, data.androidId, SERVICE, APP, CLIENT_SIG, function (err, data) {
                    if (err) {
                        return callback(err, null);
                    }
                    callback(null, data.Auth);
                });
            }
        });

    }
}
