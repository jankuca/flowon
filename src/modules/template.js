var Path = require('path'),
	FileSystem = require('fs'),
	Class = require(app.__dirname + 'modules/class.js').Class,
	EJS = require(app.__dirname + '../lib/ejs.js').EJS;

var Template = exports.Template = Class.create({
	'render': function (callback) {
		if (!this._path) {
			callback('No template file path specified');
			return;
		}

		Path.exists(this._path, function (exists) {
			if (!exists) {
				callback('Missing template: ' + this._path);
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

				var ejs,
					html;
				try {
					ejs = new EJS({
						'text': file
					});
					html = ejs.render(this);
				} catch (exc) {
					callback('EJS: ' + JSON.stringify(exc));
					return;
				}

				if (!this._layout_path) {
					callback(null, html);
				} else {
					Path.exists(this._layout_path, 'UTF-8', function (exists) {
						if (!exists) {
							callback('Missing template: ' + this._layout_path);
							return;
						}

						FileSystem.readFile(path, function (error, file) {
							if (error) {
								switch (error.errno) {
								case 21: // EISDIR
									callback('Missing template: ' + this._layout_path);
									break;
								default:
									callback('Invalid template: ' + this._layout_path);
									break;
								}
								return;
							}

							ejs = new EJS({
								'text': file
							});
							this.$content = html;

							try {
								html = ejs.render(this);
								callback(null, html);
							} catch (exc) {
								callback('EJS: ' + JSON.stringify(exc));
							}
						}.bind(this));
					}.bind(this));
				}
			}.bind(this));
		}.bind(this));
	}
});