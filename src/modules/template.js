var Path = require('path'),
	FileSystem = require('fs'),
	Class = require(app.__dirname + 'modules/class.js').Class,
	Cache = require(app.__dirname + 'modules/cache.js').Cache,
	EJS = require(app.__dirname + '../lib/ejs/ejs.js').EJS;

var Template = exports.Template = Class.create({
	'render': function (callback) {
		if (!this._path) {
			callback('No template file path specified');
			return;
		}

		var html, ejs;

		FileSystem.stat(this._path, function (error, stats) {
			if (error || !stats.isFile()) {
				callback('Missing template: ' + this._path);
				return;
			}
				
			// Check the cache
			Cache.get('ejs_compiled', this._path, function (cache) {
				if (cache && cache.created > Math.round(new Date(stats.mtime).getTime() / 1000)) {
					ejs = new EJS({
						'precompiled': cache.data
					});
					try {
						html = ejs.render(this);
					} catch (exc) {
						callback('Template error: ' + exc.message);
						return;
					}

					if (!this._layout_path) {
						callback(null, html);
						return;
					}

					this.$content = html;
					this._path = this._layout_path;
					this._layout_path = undefined;
					this.render(callback);
					return;
				}

				FileSystem.readFile(this._path, 'UTF-8', function (error, file) {
					if (error) {
						switch (error.errno) {
						case 21: // EISDIR
							callback('Missing template: ' + this._path);
							break;
						default:
							callback('Invalid template: ' + this._path);
							break;
						}
						return;
					}

					ejs = new EJS({
						'text': file
					});

					try {
						html = ejs.render(this);

						Cache.set('ejs_compiled', this._path, ejs.out());
					} catch (exc) {
						callback('Template error: ' + exc.message);
						return;
					}

					if (!this._layout_path) {
						callback(null, html);
					} else {
						this.$content = html;
						this._path = this._layout_path;
						this._layout_path = undefined;
						this.render(callback);
					}
				}.bind(this));
			}.bind(this));
		}.bind(this));
	}
});