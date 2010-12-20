var Path = require('path'),
	Class = require(app.__dirname + 'modules/class.js').Class,
	Template = require(app.__dirname + 'modules/template.js').Template;

exports.Controller = Class.create({
	'_format': 'html',

	'initialize': function () {
		this.template = new Template();
		this.template._layout_path = Path.join(app._cfg.app_dir, 'templates', this._namespace, '@layout.' + this._format + '.ejs');
	},

	'header': function (key, value) {
		if (value === undefined) {
			return this._response.getHeader(key);
		} else {
			this._response.setHeader(key, value);
		}
	},

	'terminate': function (status, template_path, message) {
		if (typeof arguments[0] == 'number') {
			this._response.status = arguments[0];
		} else if (arguments.length === 1) {
			message = arguments[0];
		}

		if (arguments.length == 2) {
			message = arguments[1];
			if (typeof arguments[0] == 'number') {
				template_path = app.__dirname + 'templates/error.' + this._format + '.ejs';
			} else {
				template_path = arguments[0];
			}
		}

		var template = new Template();
		template._path = template_path;

		template._response = this._response;
		template.message = message;

		template.render(function (error, body) {
			if (error) {
				this.header('content-type', 'text/plain; charset=UTF-8');
				this._response.write(message + "\n\n" + error);
				this._response.end();
				return;
			}

			this._response.header('content-type', 'text/html; charset=UTF-8');
			this._response.write(body);
			this._response.end();
		}.bind(this));
	},

	'render': function (status) {
		if (typeof status == 'number') {
			this._response.status = status;
		}

		this.template._path = Path.join(app._cfg.app_dir, 'templates', this._namespace, this._name, this._view + '.' + this._format + '.ejs');
		this.template.render(function (error, body) {
			if (error) {
				return this.terminate(503, error);
			}

			if (this._response.headers['content-type'] === undefined) {
				var e = this.template._path.split('.');
				switch (e[e.length - 2] || 'txt') {
				case 'html':
					this.header('content-type', 'text/html; charset=UTF-8');
					break;
				default:
					this.header('content-type', 'text/plain; charset=UTF-8');
				}
			}

			this._response.write(body);
			this._response.end();
		}.bind(this));
	}
});