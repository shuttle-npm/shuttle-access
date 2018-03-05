import $ from 'jquery';
import DefineMap from 'can-define/map/';
import DefineList from 'can-define/list/';
import Api from 'shuttle-can-api';
import each from 'can-util/js/each/';

const Messages = DefineMap.extend({
    missingCredentials: {
        type: 'string',
        default: 'No credentials specified.'
    },
    loginFailure: {
        type: 'string',
        default: 'Invalid login credentials.'
    },
    missingStorage: {
        type: 'string',
        default: 'No storage has been specified.'
    }
});

var Access = DefineMap.extend({
    url: {
        type: 'string',
        default: '',
        get(value) {
            if (!value) {
                throw new Error('Use `import {options} from \'shuttle-access\';` to get the options and then set the api endpoint url `this.url = \'http://server-endpoint\';`.')
            }

            return value + (!value.endsWith('/') ? '/' : '');
        }
    },
    messages: {
        Default: Messages
    },
    storage: {
        default: localStorage
    },
    _api: {
        default() {
            return {};
        }
    },

    username: {
        type: 'string',
        default: ''
    },

    token: {
        type: 'string',
        default: undefined
    },

    isUserRequired: 'boolean',

    permissions: {
        default: function(){
            return new DefineList();
        }
    },

    hasSession: function () {
        return this.token != undefined;
    },

    hasPermission: function (permission) {
        var result = false;
        var permissionCompare = permission.toLowerCase();

        this.permissions.forEach(function (item) {
            if (result) {
                return;
            }

            result = item.permission === '*' || item.permission.toLowerCase() === permissionCompare;
        });

        return result;
    },

    removePermission: function (permission) {
        this.permissions = this.permissions.filter(function (item) {
            return item.permission !== permission;
        });
    },

    start: function () {
        var self = this;

        if (!this.storage) {
            throw new Error(this.messages.missingStorage);
        }

        this._api.anonymous = new Api({
            endpoint: this.url + 'anonymouspermissions'
        });

        this._api.sessions = new Api({
            endpoint: this.url + 'sessions'
        });

        return this._api.anonymous.list()
            .then(function (data) {
                const username = self.storage.getItem('username');
                const token = self.storage.getItem('token');

                self.isUserRequired = data.isUserRequired;

                each(data.permissions,
                    function (item) {
                        self.addPermission('anonymous', item.permission);
                    });

                if (!!username && !!token) {
                    return self.login({username: username, token: token})
                        .then(function (response) {
                            return response;
                        });
                }

                return data;
            });
    },

    addPermission: function (type, permission) {
        if (this.hasPermission(permission)) {
            return;
        }

        this.permissions.push({type: type, permission: permission});
    },

    login: function (options) {
        var self = this;

        return new Promise((resolve, reject) => {
            if (!options) {
                reject(new Error(this.messages.missingCredentials));
                return;
            }

            var usingToken = !!this.token;

            return this._api.sessions.post({
                username: this.username,
                password: this.password,
                token: this.token
            })
                .then(function (response) {
                    if (response.registered) {
                        self.storage.setItem('username', this.username);
                        self.storage.setItem('token', response.token);

                        self.username = this.username;
                        self.token = response.token;
                        self.isUserRequired = false;

                        self.removeUserPermissions();

                        each(response.permissions,
                            function (permission) {
                                self._addPermission('user', permission);
                            });

                        resolve();
                    } else {
                        if (usingToken) {
                            self.username = undefined;
                            self.token = undefined;

                            self.storage.removeItem('username');
                            self.storage.removeItem('token');
                        } else {
                            reject(new Error(this.messages.loginFailure));
                        }
                    }
                })
                .catch(function (error) {
                    reject(error);
                });
        });
    },

    logout: function () {
        this.username = undefined;
        this.token = undefined;

        this.storage.removeItem('username');
        this.storage.removeItem('token');

        this.removeUserPermissions();
    },

    removeUserPermissions: function () {
        this.permissions = this.permissions.filter(function (item) {
            return item.type !== 'user';
        });
    },

    loginStatus: {
        get: function () {
            return this.isUserRequired ? 'user-required' : this.token == undefined ? 'not-logged-in' : 'logged-in';
        }
    }
});

var access = new Access();

$.ajaxPrefilter(function (options, originalOptions) {
    options.beforeSend = function (xhr) {
        if (access.token) {
            xhr.setRequestHeader('access-sessiontoken', access.token);
        }

        if (originalOptions.beforeSend) {
            originalOptions.beforeSend(xhr);
        }
    };
});

export default access;