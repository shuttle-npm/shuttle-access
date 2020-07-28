import axios from 'axios';
import guard from 'shuttle-guard';

export let messages = {
    missingCredentials: 'No credentials specified.',
    loginFailure: 'Invalid login credentials.',
    invalidStorage: 'An invalid \'storage\' instance has been specified.  It should have a \'getItem\', \'setItem\', and \'removeItem\' method.'
};

export class Permission {
    constructor(type, permission) {
        this.type = type;
        this.permission = permission;
    }
};

export class Anonymous {
    constructor(isUserRequired, permissions) {
        this.isUserRequired = isUserRequired;
        this.permissions = permissions;
    }
};

export class Access {
    constructor(url, options) {
        guard.againstUndefined(url, 'url');

        var o = options || {};

        this._url = url + (!url.endsWith('/') ? '/' : '');
        o.storage = o.storage || localStorage;

        if (typeof o.storage.getItem !== 'function'
            ||
            typeof o.storage.setItem !== 'function'
            ||
            typeof o.storage.removeItem !== 'function') {
            throw new Error(messages.invalidStorage);
        }

        this._storage = o.storage;
        this.username = '';
        this.token = '';
        this.isUserRequired = false;
        this.permissions = [];
    }

    url(value) {
        return this._url + value;
    }

    get hasSession() {
        return !!this.token;
    }

    hasPermission(permission) {
        var result = false;
        var permissionCompare = permission.toLowerCase();

        this.permissions.forEach(function (item) {
            if (result) {
                return;
            }

            result = item.permission === '*' || item.permission.toLowerCase() === permissionCompare;
        });

        return result;
    }

    removePermission(permission) {
        this.permissions = this.permissions.filter(function (item) {
            return item.permission !== permission;
        });
    }

    start() {
        var self = this;

        if (!this._storage) {
            throw new Error(messages.missingStorage);
        }

        axios.interceptors.request.use(function (config) {
            config.headers['access-sessiontoken'] = self._storage.getItem('token');

            return config;
        });

        return axios.get(this.url('permissions/anonymous'))
            .then(function (response) {
                guard.againstUndefined(response, 'response');
                guard.againstUndefined(response.data, 'response.data');
                guard.againstUndefined(response.data.permissions, 'response.data.permissions');
                guard.againstUndefined(response.data.isUserRequired, 'response.data.isUserRequired');

                const username = self._storage.getItem('username');
                const token = self._storage.getItem('token');

                self.isUserRequired = response.data.isUserRequired;

                response.data.permissions.forEach(function (item) {
                    self.addPermission('anonymous', item.permission);
                });

                if (!!username && !!token) {
                    return self.login({ username: username, token: token })
                        .then(function (response) {
                            return response;
                        });
                }

                return response.data;
            });
    }

    addPermission(type, permission) {
        if (this.hasPermission(permission)) {
            return;
        }

        this.permissions.push({ type: type, permission: permission });
    }

    login(credentials) {
        var self = this;

        return new Promise((resolve, reject) => {
            if (!credentials || !credentials.username || !(!!credentials.password || !!credentials.token)) {
                reject(new Error(messages.missingCredentials));
                return;
            }

            var usingToken = !!credentials.token;

            return axios.post(this.url('sessions'), {
                username: credentials.username,
                password: credentials.password,
                token: credentials.token
            })
                .then(function (response) {
                    guard.againstUndefined(response, 'response');
                    guard.againstUndefined(response.data, 'response.data');
                    guard.againstUndefined(response.data.registered, 'response.data.registered');

                    const data = response.data;
    
                    if (data.registered) {
                        self._storage.setItem('username', credentials.username);
                        self._storage.setItem('token', data.token);

                        self.username = credentials.username;
                        self.token = data.token;
                        self.isUserRequired = false;

                        self.removeUserPermissions();

                        data.permissions.forEach(function (item) {
                            self.addPermission('user', item.permission);
                        });

                        resolve();
                    } else {
                        if (usingToken) {
                            self.username = undefined;
                            self.token = undefined;

                            self._storage.removeItem('username');
                            self._storage.removeItem('token');
                        } else {
                            reject(new Error(messages.loginFailure));
                        }
                    }
                })
                .catch(function (error) {
                    reject(error);
                });
        });
    }

    logout() {
        this.username = undefined;
        this.token = undefined;

        this._storage.removeItem('username');
        this._storage.removeItem('token');

        this.removeUserPermissions();
    }

    removeUserPermissions() {
        this.permissions = this.permissions.filter(function (item) {
            return item.type !== 'user';
        });
    }

    get loginStatus() {
        return this.isUserRequired ? 'user-required' : this.token == undefined ? 'not-logged-in' : 'logged-in';
    }
};

export default Access;