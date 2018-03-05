import 'steal-mocha';
import chai from 'chai';
import fixture from 'can-fixture';
import {options} from 'shuttle-access';
import access from 'shuttle-access';

var assert = chai.assert;

var tracking = {
    anonymousCalls: 0
}

fixture({
    'GET /access/anonymouspermissions': function () {
        try {
            switch (tracking.anonymousCalls) {
                case 0: {
                    return {
                        isUserRequired: true,
                        permissions: [{permission: 'test://anonymous'}]
                    }
                }
                case 1: {
                    return {
                        isUserRequired: false,
                        permissions: [{permission: 'test://anonymous'}]
                    }
                }
            }
        }
        finally {
            tracking.anonymousCalls++;
        }
    }
});


describe('Access', function () {
    it('should not be able to start with no options.url set', function () {
        assert.throws(() => access.start());
    });

    it('should be able to start and get anonymous permissions with user required', function () {
        access.url = 'http://access';

        access.storage = {
            getItem() {
                return undefined;
            }
        };

        return access.start()
            .then(function (response) {
                assert.isTrue(response.isUserRequired);
                assert.isTrue(access.hasPermission('test://anonymous'));

                access.storage = localStorage;
            });
    });

    it('should be able to start and get anonymous permissions without user required', function () {
        access.storage = {
            getItem() {
                return undefined;
            }
        };

        return access.start()
            .then(function (response) {
                assert.isFalse(response.isUserRequired);
                assert.isTrue(access.hasPermission('test://anonymous'));

                access.storage = localStorage;
            });
    });
});
