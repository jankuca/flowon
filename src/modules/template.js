/*global app*/

var Path = require('path'),
	FileSystem = require('fs'),
	EJS = require('ejs/ejs.js').EJS;

global.Template = Function.inherit(function (controller) {
	this._controller = controller;
}, {
	'setLayout': function (name, format) {
		this._layout_path = name ? Path.join(app._cfg.app_dir, 'templates', this._namespace, '@' + name + '.' + (format || 'html') + '.ejs') : undefined;
	},

	'render': function (callback) {
		if (!this._path) {
			return callback('No template file path specified');
		}

		var template = this;

		FileSystem.stat(template._path, function (error, stats) {
			if (error || !stats.isFile()) {
				return callback('Missing template: ' + template._path);
			}
				
			// Check the cache
			Cache.get('ejs_compiled', template._path, function (cache) {
				if (cache && cache.created > Math.round(new Date(stats.mtime).getTime() / 1000)) {
					var ejs = new EJS({
						'precompiled': cache.data,
						'controller': template._controller
					});
					var html;
					try {
						html = ejs.render(template);
					} catch (exc) {
						return callback('Template error: ' + exc.message);
					}

					if (!template._layout_path) {
						return callback(null, html);
					}

					template.$content = html;
					template._path = template._layout_path;
					template._layout_path = undefined;
					template.render(callback);
					return;
				}

				FileSystem.readFile(template._path, 'UTF-8', function (error, file) {
					if (error) {
						switch (error.errno) {
						case 21: // EISDIR
							return callback('Missing template: ' + template._path);
						default:
							return callback('Invalid template: ' + template._path);
						}
					}

					var ejs = new EJS({
						'text': file,
						'controller': template._controller
					});
					var html;
					try {
						html = ejs.render(template);
						Cache.set('ejs_compiled', template._path, ejs.out());
					} catch (exc) {
						callback('Template error: ' + exc.message);
						return;
					}

					if (!template._layout_path) {
						callback(null, html);
					} else {
						template.$content = html;
						template._path = template._layout_path;
						template._layout_path = undefined;
						template.render(callback);
					}
				});
			});
		});
	}
});

Template.Helpers = EJS.Helpers.prototype;

Template.loadHelpers = function (dirname, callback) {
	FileSystem.readdir(dirname, function (error, files) {
		if (error) {
			console.error('Could not load template helpers from ' + dirname);
		} else {
			files.forEach(function (file) {
				Template.Helpers[file.split('.')[0]] = require(Path.join(dirname, file)).helper;
			});
			console.log('Loaded template helpers from ' + dirname);
		}

		if (typeof callback === 'function') {
			callback();
		}
	});
};