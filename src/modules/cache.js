/*global app*/
/*global APP_DIR*/

var Path = require('path'),
	FileSystem = require('fs'),
	Base64 = require('base64/base64.js').Base64,
	RelativeDate = require('relativedate/relativedate.js');

var Cache = global.Cache = Function.inherit(function (namespace, key) {
	this.namespace = namespace;
	this.key = key;
});

Cache.get = function (namespace, key, callback) {
	// We do not need to bother with getting the data if there is no callback to collect it
	if (typeof callback !== 'function') {
		return;
	}

	key = Base64.encode(key);
	var memcached = app.memcached;
	// Check if we are using memcached; if not, fall back to file cache
	if (memcached) {
		memcached.on('connect', function () {
			memcached.get(namespace + ':' + key, function (data, error) {
				var errors = ['ERROR', 'NOT_FOUND', 'CLIENT_ERROR', 'SERVER_ERROR'];
				if (data.length <= 12 && errors.indexOf(data) !== -1) {
					return callback(null);
				}

				data = JSON.parse(data);
				if (data.expires && data.expires < Math.round(new Date().getTime() / 1000)) {
					callback(null);

					// delete the expired cache
					memcached.remove(namespace + ':' + key, function () {
						memcached.close();
					});
					return;
				}

				var cache = new Cache(namespace, key);
				cache.memcached = true;
				cache.data = data.data;
				cache.created = data.created;
				cache.expires = data.expires;
				callback(cache);

				memcached.close();
			});
		});
		memcached.once('error', function (error) {
			console.log('error connecting to memcached');
			callback(null);
		});
		memcached.connect();
	} else {
		var path = Path.join(APP_DIR, 'cache', namespace + '__' + key);
		FileSystem.stat(path, function (error, stats) {
			if (error || !stats.isFile()) {
				callback(null);
				return;
			}

			FileSystem.readFile(path, 'UTF-8', function (error, data) {
				if (error) {
					callback(null);
					return;
				}

				data = JSON.parse(data);
				if (data.expires && data.expires < Math.round(new Date().getTime() / 1000)) {
					callback(null);

					// delete the expired cache
					FileSystem.unlink(path);
					return;
				}

				var cache = new Cache(namespace, key);
				cache.memcached = false;
				cache.data = data.data;
				cache.created = data.created;
				cache.expires = data.expires;

				callback(cache);
			});
		});
	}
};

Cache.set = function (namespace, key, data, expires, callback) {
	if (arguments.length === 4 && typeof arguments[3] === 'function') {
		callback = arguments[3];
		expires = undefined;
	}

	var add = 0,
		now = Math.round(new Date().getTime() / 1000);

	key = Base64.encode(key);

	// expiration
	if (expires === undefined) {
		expires = 0;
	} else if (typeof expires === 'string') {
		if (expires[0] !== '+') {
			expires = 0;
		} else {
			add = RelativeDate.parse(expires);
			expires += add;
		}
	}
	if (expires !== 0 && !add) {
		add = expires - now;
	}

	data = {
		'data': data,
		'created': now,
		'expires': expires
	};
	data = JSON.stringify(data);

	var memcached = app.memcached;
	if (memcached) {
		memcached.on('connect', function () {
			memcached.set(namespace + ':' + key, data, callback, add);
		});
		memcached.once('error', function () {
			console.log('error connecting to memcached');
			if (typeof callback === 'function') {
				callback();
			}
		});
	} else {
		var path = Path.join(APP_DIR, 'cache', namespace + '__' + key);
		FileSystem.writeFile(path, data, function (error) {
			if (typeof callback === 'function') {
				callback();
			}
			if (error) {
				console.log(error);
			}
		});
	}
};

Cache.remove = function (namespace, key, callback) {
	key = Base64.encode(key);
	// Check if we are using memcached; if not, fall back to file cache
	var memcached = app.getMemcached();
	if (memcached) {
		memcached.on('connect', function () {
			memcached['delete'](namespace + ':' + key, callback);
		});
		memcached.once('error', function (error) {
			console.log('error connecting to memcached');
			if (typeof callback === 'function') {
				callback();
			}
		});
		memcached.connect();
	} else {
		var path = Path.join(APP_DIR, 'cache', namespace + '__' + key);
		Path.exists(path, function (exists) {
			if (!exists) {
				callback();
				return;
			}

			FileSystem.unlink(path, callback);
		});
	}	
};