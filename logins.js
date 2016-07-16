var api_url = 'https://pgorelease.nianticlabs.com/plfe/rpc'
var login_url = 'https://sso.pokemon.com/sso/login?service=https%3A%2F%2Fsso.pokemon.com%2Fsso%2Foauth2.0%2FcallbackAuthorize'
var login_oauth = 'https://sso.pokemon.com/sso/oauth2.0/accessToken'

module.exports = {
    PokemonClub: function(user, pass, self, callback) {
        var options = {
          url: login_url,
          headers: {
            'User-Agent': 'niantic'
          }
        };

        self.request.get(options, function(e, r, body) {
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

            self.request.post(options, function(e, r, body) {
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

                self.request.post(options, function(e, r, body) {
                    var token = body.split("token=")[1]
                    token = token.split("&")[0]
                    self.DebugPrint("[i] Session token: " + token)
                    callback(token)
                });

            });

        });
    }
}
