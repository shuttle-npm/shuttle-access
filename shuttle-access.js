import $ from 'jquery';
import DefineMap from 'can-define/map/';
import DefineList from 'can-define/list/';
import Api from 'shuttle-can-api';
import each from 'can-util/js/each/';
import guard from 'shuttle-guard';

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
    },
    missingSessionsApi: {
        type: 'string',
        default: 'The \'sessions\' api has not been set.  Make a call to \'access.start()\' before accessing the \'sessions\' api.'
    },
    missingAnonymousApi: {
        type: 'string',
        default: 'The \'anonymous\' api has not been set.  Make a call to \'access.start()\' before accessing the \'anonymous\' api.'
    },
    invalidStorage: {
        type: 'string',
        default: 'An invalid \'storage\' instance has been specified.  It should have a \'getItem\', \'setItem\', and \'removeItem\' method.'
    }
});

export let messages = new Messages({});

export const PermissionMap = DefineMap.extend({
    type: {
        type: 'string',
        default: 'user'
    },
    permission: {
        type: 'string',
        default: ''
    }
});

export const PermissionList = DefineList.extend({
    '#': PermissionMap
});

export const AnonymousMap = DefineMap.extend({
    isUserRequired: {
        type: 'boolean',
        default: false
    },
    permissions: {
        Default: PermissionList
    }
});

const AccessApi = DefineMap.extend({
    sessions: {
        get(value) {
            if (!value) {
                throw new Error(messages.missingSessionsApi);
            }

            return value;
        }
    },
    anonymous: {
        get(value) {
            if (!value) {
                throw new Error(messages.missingAnonymousApi);
            }

            return value;
        }
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

    api: {
        Default: AccessApi
    },

    storage: {
        default() {
            return localStorage
        },
        set(newval) {
            guard.againstUndefined(newval, 'newval');

            if (typeof newval.getItem !== 'function'
                ||
                typeof newval.setItem !== 'function'
                ||
                typeof newval.removeItem !== 'function') {
                throw new Error(messages.invalidStorage);
            }

            return newval;
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
        Default: PermissionList
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
            throw new Error(messages.missingStorage);
        }

        this.api.anonymous = new Api({
            endpoint: this.url + 'anonymouspermissions',
            Map: AnonymousMap
        });

        this.api.sessions = new Api({
            endpoint: this.url + 'sessions'
        });

        return this.api.anonymous.map()
            .then(function (map) {
                const username = self.storage.getItem('username');
                const token = self.storage.getItem('token');

                self.isUserRequired = map.isUserRequired;

                each(map.permissions,
                    function (item) {
                        self.addPermission('anonymous', item.permission);
                    });

                if (!!username && !!token) {
                    return self.login({username: username, token: token})
                        .then(function (response) {
                            return response;
                        });
                }

                return map;
            });
    },

    addPermission: function (type, permission) {
        if (this.hasPermission(permission)) {
            return;
        }

        this.permissions.push({type: type, permission: permission});
    },

    login: function (credentials) {
        var self = this;

        return new Promise((resolve, reject) => {
            if (!credentials || !credentials.username || !(!!credentials.password || !!credentials.token)) {
                reject(new Error(messages.missingCredentials));
                return;
            }

            var usingToken = !!this.token;

            return this.api.sessions.post({
                username: credentials.username,
                password: credentials.password,
                token: credentials.token
            })
                .then(function (response) {
                    if (response.registered) {
                        self.storage.setItem('username', credentials.username);
                        self.storage.setItem('token', response.token);

                        self.username = credentials.username;
                        self.token = response.token;
                        self.isUserRequired = false;

                        self.removeUserPermissions();

                        each(response.permissions,
                            function (item) {
                                self.addPermission('user', item.permission);
                            });

                        resolve();
                    } else {
                        if (usingToken) {
                            self.username = undefined;
                            self.token = undefined;

                            self.storage.removeItem('username');
                            self.storage.removeItem('token');
                        } else {
                            reject(new Error(messages.loginFailure));
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