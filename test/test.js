import 'steal-mocha';
import chai from 'chai';
import fixture from 'can-fixture';
import {options} from 'shuttle-access';
import access from 'shuttle-access';
import DefineMap from 'can-define/map/';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);

var assert = chai.assert;

var tracking = {
    anonymousCalls: 0
}

fixture({
    'GET /access/anonymouspermissions'() {
        try {
            return {
                isUserRequired: tracking.anonymousCalls === 0,
                permissions: [{permission: 'test://anonymous'}]
            };
        }
        finally {
            tracking.anonymousCalls++;
        }
    },
    'POST /access/sessions'(request) {
        var response = request.data;

        response.registered = true;
        response.token = 'token';
        response.permissions = [{permission: 'test://user-permission'}]

        return response;
    }
});

var Storage = DefineMap.extend({
    username: {
        type: 'string',
        default: undefined
    },
    token: {
        type: 'string',
        default: undefined
    },
    getItem(name) {
        switch (name) {
            case 'username': {
                return this.username;
            }
            case 'token': {
                return this.token;
            }
        }
    },
    setItem() {
    },
    removeItem() {
    }
});

var storage = new Storage();

describe('Access', function () {
    it('should not be able to start with no options.url set', function () {
        assert.throws(() => access.start());
    });

    it('should not be able to use sessions api if not set', function () {
        assert.throws(() => access.api.sessions.list());
    })

    it('should not be able to use anonymous api if not set', function () {
        assert.throws(() => access.api.anonymous.list());
    })

    it('should be able to start and get anonymous permissions with user required', function () {
        access.url = 'http://access';

        access.storage = storage;

        return access.start()
            .then(function (response) {
                assert.isTrue(response.isUserRequired);
                assert.isTrue(access.hasPermission('test://anonymous'));

                access.storage = localStorage;
            });
    });

    it('should be able to start and get anonymous permissions without user required', function () {
        access.storage = storage;

        return access.start()
            .then(function (response) {
                assert.isFalse(response.isUserRequired);
                assert.isTrue(access.hasPermission('test://anonymous'));

                access.storage = localStorage;
            });
    });

    it('should be able to log in after start when username and token are available', function () {
        access.storage = storage;

        storage.username = 'user';
        storage.token = 'token';

        return access.start()
            .then(function (response) {
                assert.isTrue(access.hasPermission('test://anonymous'));
                assert.equal(access.username, 'user');
                assert.equal(access.token, 'token');

                access.storage = localStorage;
            });
    });

    it('should not be able to log in when no credentials are specified', function(){
        assert.isRejected(access.login({}));
    });

    it('should be able to log in and then out again', function(){
        access.storage = storage;

        return new Promise((resolve, reject) => {
            access.start()
                .then(function (response) {
                    access.login({
                        username: 'user',
                        password: 'the-password'
                    })
                        .then(function(){
                            assert.isTrue(access.hasPermission('test://anonymous'));
                            assert.isTrue(access.hasPermission('test://user-permission'));
                            assert.equal(access.username, 'user');
                            assert.equal(access.token, 'token');

                            access.logout();

                            assert.isTrue(access.hasPermission('test://anonymous'));
                            assert.isFalse(access.hasPermission('test://user-permission'));
                            assert.isUndefined(access.username);
                            assert.isUndefined(access.token);

                            access.storage = localStorage;

                            resolve();
                        })
                });
        });
    });
});
