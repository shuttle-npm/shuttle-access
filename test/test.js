import chai from 'chai';
import Access from '../shuttle-access.js';
import chaiAsPromised from 'chai-as-promised';

var axios = require("axios");
var MockAdapter = require("axios-mock-adapter");
var mock = new MockAdapter(axios);

chai.use(chaiAsPromised);

var assert = chai.assert;

var tracking = {
    anonymousCalls: 0
}

mock.onGet('http://access/permissions/anonymous').reply(function () {
    try {
        return [
            200,
            {
                isUserRequired: tracking.anonymousCalls === 0,
                permissions: [{ permission: 'test://anonymous' }]
            }
        ];
    }
    finally {
        tracking.anonymousCalls++;
    }
});

mock.onPost('http://access/sessions').reply(function(config){
    var response = JSON.parse(config.data);

    response.registered = true;
    response.token = 'token';
    response.permissions = [{permission: 'test://user-permission'}]

    return [
        200,
        response
    ];
});

class Storage {
    constructor(username, token) {
        this.username = username;
        this.token = token;
    }
    getItem(name) {
        switch (name) {
            case 'username': {
                return this.username;
            }
            case 'token': {
                return this.token;
            }
        }
    }
    setItem() {
    }
    removeItem() {
    }
};

describe('Access', function () {
    it('should not be able to construct without a url', function () {
        assert.throws(() => new Access());
    });

    it('should be able to initialize and get anonymous permissions with user required', function () {
        var access = new Access('http://access', { storage: new Storage() });

        access.initialize()
            .then(function (response) {
                assert.isTrue(response.isUserRequired);
                assert.isTrue(access.hasPermission('test://anonymous'));
            });
    });

    it('should be able to initialize and get anonymous permissions without user required', function () {
        var access = new Access('http://access', { storage: new Storage() });

        access.initialize()
            .then(function (response) {
                assert.isFalse(response.isUserRequired);
                assert.isTrue(access.hasPermission('test://anonymous'));
            });
    });

    it('should be able to log in after initialize when username and token are available', function () {
        var access = new Access('http://access', { storage: new Storage('user', 'token') });

        access.initialize()
            .then(function (response) {
                assert.isTrue(access.hasPermission('test://anonymous'));
                assert.equal(access.username, 'user');
                assert.equal(access.token, 'token');
            });
    });

    it('should not be able to log in when no credentials are specified', function () {
        var access = new Access('http://access', { storage: new Storage() });

        assert.isRejected(access.login({}));
    });

    it('should be able to log in and then out again', function () {
        var access = new Access('http://access', { storage: new Storage() });

        return new Promise((resolve, reject) => {
            access.initialize()
                .then(function (response) {
                    access.login({
                        username: 'user',
                        password: 'the-password'
                    })
                        .then(function () {
                            assert.isTrue(access.hasPermission('test://anonymous'));
                            assert.isTrue(access.hasPermission('test://user-permission'));
                            assert.equal(access.username, 'user');
                            assert.equal(access.token, 'token');

                            access.logout();

                            assert.isTrue(access.hasPermission('test://anonymous'));
                            assert.isFalse(access.hasPermission('test://user-permission'));
                            assert.isUndefined(access.username);
                            assert.isUndefined(access.token);

                            resolve();
                        })
                });
        });
    });
});
