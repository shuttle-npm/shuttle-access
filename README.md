# shuttle-access

Package for use in JavaScript applications to integrate with Shuttle.Access back-end.

```
npm install shuttle-access
```

## Initialization

Create a new instance of `Access`:

```
import Access from 'shuttle-access';

var access = new Access('http://access-api-url');
```

You may also specify an `options` argument containing the following:

| Option | Default | Description |
| --- | --- | --- |
| `storage` | `localStorage` | A storage mechanism for the `username` and `token` values used for authentication.  Must contain `getItem(name)`, `setItem(name, value)`, and `removeItem(name)` functions. |

```
import Access from 'shuttle-access';

var access = new Access('http://access-api-url', { 
    storage: {
        getItem: function(name) {},
        setItem: function(name, value) {},
        removeItem: function(name) {}
    }
});
```

Next we need to `initialize` the istance:

```
access.initilize(); // returns promise
```

This will retrieve all the anonymous permissions from the `/permissions/anonymous` endpoint and add them as type `anonymous`.  The endpoint can also return an `isUserRequired` property on the response.  If `true` then there are no users registered.

Should the `storage` contain a `token` then a `shuttle-access` will attempt to create a session by posting the `token` to the `/sessions` endpoint.

## Login

```
access.login(credentials); // returns promise
```

Performs an explicit login by using the specified `credentials` which should contain either `username` and `password`, or `token`.  The session-creation will be attempted by sending a `POST` to the `/sessions` endpoint using the following JSON `body`:

```
{
    username: credentials.username,
    password: credentials.password,
    token: credentials.token
}
```

A login expects the following response from the `POST` to the `/sessions` endpoint:

```
{
	registered: (boolean), // true when session registered; else false
	username: (string), // returns the username associated with the session
	token: (string), // a session token that is specific to the server 
	permissions: ['access://permission-on', 'another', ...]
}
```

If `registered` is `true` then the `username` and `token` will be set on the `storage` for future reference.  Each `permission` will be stored as type `user`.  In addition the `username` and `token` properties on the `access` instance will also be set.

## Logout

```
access.logout();
```

The `username` and `token` properties on the `access` as well as the `storage` instances.

## Permissions

Permissions are unique.  The permissions may be accessed using the following methods:

| Method | Arguments | Description |
| --- | --- | --- |
| `hasPermission` | `permission` | Returns `true` if the permission is in the `access` instance; else `false` |
| `removePermission` | `permission` | Removes the given permission, if found, from the `access` instance. |
| `addPermission` | `type, permission` | The `type` is a grouping mechanism and the `permission` still has to be unique. |
| `removePermissions` | `type` | Remove all permissions of the given `type`. |

## Login status

```
var status = access.loginStatus;
```

Returns:

| Value | Description |
| --- | --- |
| `user-required` | When the `/permissions/anonymous` called returned `isUserRequired`. |
| `not-logged-in` | When there is no `token` value. |
| `logged-in` | When there is a `token` value. |

