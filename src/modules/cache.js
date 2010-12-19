var Path = require('path'),
	FileSystem = require('fs'),
	Base64 = require(app.__dirname + '../lib/base64/base64.js').Base64,
	Class = require(app.__dirname + 'modules/class.js').Class;

var Cache = exports.Cache = Class.create({
	'initialize': function (namespace, key) {
		this.namespace = namespace;
		this.key = key;
	}
});

Cache.get = function (namespace, key, callback) {
	// We do not need to bother with getting the data if there is no callback specified
	if (typeof callback != 'function') {
		return;
	}

	key = Base64.encode(key);
	var memcached = app.getMemcached();
	// Check if we are using memcached; if not, fall back to file cache
	if (memcached) {
		memcached.on('connect', function () {
			memcached.get(namespace + ':' + key, function (data, error) {
				var errors = ['ERROR', 'NOT_FOUND', 'CLIENT_ERROR', 'SERVER_ERROR'];
				if (data.length <= 12 && errors.indexOf(data) > -1) {
					callback(null);
					return;
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
		var path = Path.join(app._cfg.app_dir, 'cache', namespace + '__' + key);
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
	if (typeof expires == 'function') {
		callback = expires;
		expires = undefined;
	}

	key = Base64.encode(key);

	var add = 0,
		now = Math.round(new Date().getTime() / 1000);

	// expiration
	if (expires === undefined) {
		expires = 0;
	} else if (typeof expires == 'string') {
		if (expires[0] != '+') {
			expires = 0;
		} else {
			var match = expires.match(/^\+\s*(\d+)\s*([a-z]{3})/i);
			if (!match) {
				expires = 0;
			} else {
				add = parseInt(match[1], 10);
				expires = now;
				switch (match[2]) {
				case 'min':
					add *= 60;
					break;
				case 'hou':
					add *= 3600;
					break;
				case 'day':
					add *= 3600 * 24;
					break;
				case 'week':
					add *= 3600 * 24 * 7;
					break;
				case 'month':
					add *= 3600 * 24 * 30;
					break;
				case 'year':
					add *= 3600 * 24 * 365;
					break;
				}
				expires += add;
			}
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

	var memcached = app.getMemcached();
	if (memcached) {
		memcached.on('connect', function () {
			memcached.set(namespace + ':' + key, data, callback, add);
		}.bind(this));
		memcached.once('error', function () {
			console.log('error connecting to memcached');
			if (typeof callback == 'function') {
				callback();
			}
		}.bind(this));
	} else {
		var path = Path.join(app._cfg.app_dir, 'cache', namespace + '__' + key);
		FileSystem.writeFile(path, data, function (error) {
			if (typeof callback == 'function') {
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
	var memcached = app.getMemcached();
	// Check if we are using memcached; if not, fall back to file cache
	if (memcached) {
		memcached.on('connect', function () {
			memcached['delete'](namespace + ':' + key, callback);
		});
		memcached.once('error', function (error) {
			console.log('error connecting to memcached');
			if (typeof callback == 'function') {
				callback();
			}
		});
		memcached.connect();
	} else {
		var path = Path.join(app._cfg.app_dir, 'cache', namespace + '__' + key);
		Path.exists(path, function (exists) {
			if (!exists) {
				callback();
				return;
			}

			FileSystem.unlink(path, callback);
		});
	}	
};