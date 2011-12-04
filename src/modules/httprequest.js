/*global app*/

var QueryString = require('querystring'),
	Url = require('url'),
	Formidable = require('node-formidable/lib/formidable/index');

var HttpRequest = module.exports.HttpRequest = require('events').EventEmitter.inherit(function (request) {
	this.request = request;
	this.host = request.headers.host;
	this.url = Url.parse('http://' + this.host + request.url, true);
	this.domain = this.url.hostname.split('.').slice(-2).join('.')
	this.abs_url = 'http://' + this.host + this.url.pathname + (this.url.search || '');
	this.method = request.method;
	this.headers = request.headers;
	this.ip = request.headers['x-forwarded-for'] || request.connection.remoteAddress;
	this.ready = false;
	this.closed = false;

	var _r = this,
		cookie_header = request.headers.cookie,
		ua_header = request.headers['user-agent'] || '',
		fields = (cookie_header !== undefined) ? cookie_header.split(/;\s?/) : [],
		field,
		match;

	request.once('close', function () {
		_r.closed = true;
	});

	// cookies
	this.cookies = {};
	for (var i = 0, ii = fields.length; i < ii; ++i) {
		field = fields[i].split('=', 2);
		this.cookies[field[0]] = field[1];
	}

	// browser
	if (match = ua_header.match(/Chrome\/([\d\.]+)/i)) {
		this.browser = {
			'type': 'chrome',
			'version': match[1],
		};
	} else if (match = ua_header.match(/Firefox\/([\d\.]+)/i)) {
		this.browser = {
			'type': 'firefox',
			'version': match[1],
		};
	} else if (match = ua_header.match(/Opera.*Version\/([\d\.]+)/i)) {
		this.browser = {
			'type': 'opera',
			'version': match[1],
		};
	} else if (match = ua_header.match(/Opera\/([\d\.]+)/i)) {
		this.browser = {
			'type': 'opera',
			'version': match[1],
		};
	} else if (match = ua_header.match(/MSIE ([\d\.]+)/i)) {
		this.browser = {
			'type': 'ie',
			'version': match[1],
		};
	} else if (match = ua_header.match(/Version\/([\d\.]+).*Safari/i)) {
		this.browser = {
			'type': 'safari',
			'version': match[1],
		};
	} else {
		this.browser = {
			'type': null,
			'version': '0',
		};
	}

	// data (request body)
	if (request.method === 'POST' || request.method === 'PUT') {
		var form = new Formidable.IncomingForm();
		form.parse(request, function (err, fields, files) {
			_r.data = fields;
			_r.files = files;
			_r.emit('ready');
			_r.ready = true;
		});
	} else {
		this.data = null;
		this.files = {};
		this.emit('ready');
		this.ready = true;
	}
}, {
	'on': function (type, listener) {
		this.$super(type, listener);

		if (type === 'ready' && this.ready) {
			this.emit('ready');
		}
	},

	'getHeader': function (key) {
		return this.headers[key] || null;
	},
});