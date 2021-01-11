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
    constructor(isIdentityRequired, permissions) {
        this.isIdentityRequired = isIdentityRequired;
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
        this.identityName = '';
        this.token = '';
        this.isIdentityRequired = false;
        this.permissions = [];
        this.initialized = false;
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

    initialize() {
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
                guard.againstUndefined(response.data.isIdentityRequired, 'response.data.isIdentityRequired');

                let identityName = self._storage.getItem('shuttle-access.identityName');
                let token = self._storage.getItem('shuttle-access.token');

                if (response.data.isIdentityRequired){
                    self.isIdentityRequired = true;
                    identityName = undefined;
                    token = undefined;
                } 

                response.data.permissions.forEach(function (item) {
                    self.addPermission('anonymous', item.permission);
                });

                if (!!identityName && !!token) {
                    return self.login({ identityName: identityName, token: token })
                        .then(function (response) {
                            self.initialized = true;

                            return response;
                        });
                }

                self.initialized = true;

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
            if (!credentials || !credentials.identityName || !(!!credentials.password || !!credentials.token)) {
                reject(new Error(messages.missingCredentials));
                return;
            }

            var usingToken = !!credentials.token;

            return axios.post(this.url('sessions'), {
                identityName: credentials.identityName,
                password: credentials.password,
                token: credentials.token
            })
                .then(function (response) {
                    guard.againstUndefined(response, 'response');
                    guard.againstUndefined(response.data, 'response.data');
                    guard.againstUndefined(response.data.success, 'response.data.success');

                    const data = response.data;
    
                    if (data.success) {
                        self._storage.setItem('shuttle-access.identityName', credentials.identityName);
                        self._storage.setItem('shuttle-access.token', data.token);

                        self.identityName = data.identityName;
                        self.token = data.token;
                        self.isIdentityRequired = false;

                        self.removePermissions('identity');

                        data.permissions.forEach(function (item) {
                            self.addPermission('identity', item.permission);
                        });

                        resolve(response);
                    } else {
                        if (usingToken) {
                            self.identityName = undefined;
                            self.token = undefined;

                            self._storage.removeItem('shuttle-access.identityidentityName');
                            self._storage.removeItem('shuttle-access.token');
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
        this.identityName = undefined;
        this.token = undefined;

        this._storage.removeItem('shuttle-access.identityName');
        this._storage.removeItem('shuttle-access.token');

        this.removePermissions('identity');
    }

    removePermissions(type) {
        this.permissions = this.permissions.filter(function (item) {
            return item.type !== type;
        });
    }

    get loginStatus() {
        return this.isIdentityRequired ? 'identity-required' : !this.token ? 'not-logged-in' : 'logged-in';
    }
};

export default Access;