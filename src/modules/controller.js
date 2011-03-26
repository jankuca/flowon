/*global app*/
/*global APP_DIR, SOURCE_DIR*/
require(SOURCE_DIR + 'modules/form.js')

var Path = require('path');

global.Controller = Function.inherit(function (request, response, route) {
	this._request = request;
	this._method = request.method;
	this._data = request.data;
	this._response = response;

	if (route) {
		this._namespace = route.namespace;
		this._name = route.controller;
		this._view = route.view;
	}

	this._rendered = false;
	this._format = 'html';
	this._forms = {};
	this._session = null;

	this.template = new Template(this);
	this.template._layout_path = Path.join(APP_DIR, 'templates', this._namespace, '@layout.' + this._format + '.ejs');

	Object.defineProperties(this, {
		'NO_EXECUTION_LIMIT': { 'value': 2 },
	});

	Object.defineProperty(this, 'ajax', {
		'get': function () {
			return this._request.ajax;
		},
		'set': function (value) {
		},
	});
}, {
	'startup': function () {
		this.template._namespace = this._namespace;
		// general variables
		this.template.base_uri = app._cfg.base_uri;
		this.template.browser = this._request.browser;
	},

	'header': function (key, value) {
		if (value === undefined) {
			return this._response.getHeader(key);
		} else {
			this._response.setHeader(key, value);
		}
	},

	'getSession': function () {
		if (this._session === undefined) {
			throw 'Invalid state: Session does not exist.';
		}
		
		return this._session;
	},
	'setSession': function (session) {
		this._session = session;
	},

	'getForm': function (key) {
		if (this._forms[key] !== undefined) {
			return this._forms[key];
		}

		var form = new Form(key, this._request);
		this._forms[key] = form;
		return form;
	},

	'link': function (ncv, params, abs) {
		if (arguments.length === 0) {
			return this._request.url;
		}
		if (arguments.length === 2 && typeof arguments[1] === 'boolean') {
			abs = arguments[1];
			params = undefined;
		}

		ncv = ncv.split(':');
		var len = ncv.length;

		var uri = app.router.resolve({
			'namespace': ncv[len - 3] || null,
			'controller': ncv[len - 2] || this._name || 'default',
			'view': ncv[len - 1] || 'default',
			'params': params
		});
		return !abs ? uri : 'http://' + this._request.host + uri;
	},

	'redirect': function (ncv, params) {
		this._response.status = 302;
		this.header('location', this.link(ncv.replace(/:$/, ':default'), params) || this.link());
		this._response.end();
	},

	'terminate': function (status, template_path, message) {
		if (this._rendered) {
			return;
		}

		if (typeof arguments[0] === 'number') {
			this._response.status = arguments[0];
		} else if (arguments.length === 1) {
			message = arguments[0];
		}

		if (arguments.length === 2) {
			message = arguments[1];
			if (typeof arguments[0] === 'number') {
				template_path = SOURCE_DIR + 'templates/error.' + this._format + '.ejs';
			} else {
				template_path = arguments[0];
			}
		}

		if (!message) {
			this._response.end();
			return;
		}

		var template = new Template(this);
		template._path = template_path;

		template._response = this._response;
		template.status = this._response.status;
		template.message = message;
		if (message.message !== undefined) {
			template.stack = message.stack;
		}

		template.render(function (error, body) {
			if (error) {
				this.header('content-type', 'text/plain; charset=UTF-8');
				this._response.write(message + "\n\n" + error);
				this._response.end();
				return;
			}

			this._setContentTypeHeader();
			this._response.write(body);
			this._response.end();
			this._rendered = true;
		}.bind(this));

		//this.getSession().save();
	},

	'render': function (status) {
		if (typeof status === 'number') {
			this._response.status = status;
		}

		this.template._path = Path.join(app._cfg.app_dir, 'templates', this._namespace, this._name, this._view + '.' + this._format + '.ejs');
		this.template.render(function (error, body) {
			if (error) {
				return this.terminate(503, error);
			}

			if (this._response.headers['content-type'] === undefined) {
				var e = this.template._path.split('.');
				this._setContentTypeHeader();
			}

			this._response.write(body);
			this._response.end();
			this._rendered = true;
		}.bind(this));
	},

	'_setContentTypeHeader': function (format) {
		switch (format || this._format || 'txt') {
		case 'html':
			this.header('content-type', 'text/html; charset=UTF-8');
			break;
		case 'json':
			this.header('content-type', 'application/json; charset=UTF-8');
			break;
		default:
			this.header('content-type', 'text/plain; charset=UTF-8');
		}
	}
});