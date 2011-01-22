var QueryString = require('querystring'),
	Url = require('url'),
	Class = require(app.__dirname + 'modules/class.js').Class;

var Formidable = require(app.__dirname + '../lib/node-formidable/lib/formidable/index');

var HttpRequest = exports.HttpRequest = Class.create({
	'initialize': function (request) {
		this.request = request;
		this.host = request.headers.host;
		this.url = request.url;
		this.uri = Url.parse(request.url).pathname;
		this.method = request.method;
		this.headers = request.headers;

		// cookies
		this.cookies = {};
		var cookie_header = request.headers.cookie,
			fields = (cookie_header !== undefined) ? cookie_header.split(/;\s?/) : [];
		for (var i = 0, ii = fields.length; i < ii; ++i) {
			field = fields[i].split('=', 2);
			this.cookies[field[0]] = field[1];
		}

		// browser
		var ua_header = request.headers['user-agent'];
		var match;
		if (match = ua_header.match(/Chrome\/([\d\.]+)/i)) {
			this.browser = {
				'type': 'chrome',
				'version': match[1]
			};
		} else if (match = ua_header.match(/Firefox\/([\d\.]+)/i)) {
			this.browser = {
				'type': 'firefox',
				'version': match[1]
			};
		} else if (match = ua_header.match(/Opera.*Version\/([\d\.]+)/i)) {
			this.browser = {
				'type': 'opera',
				'version': match[1]
			};
		} else if (match = ua_header.match(/Opera\/([\d\.]+)/i)) {
			this.browser = {
				'type': 'opera',
				'version': match[1]
			};
		} else if (match = ua_header.match(/MSIE ([\d\.]+)/i)) {
			this.browser = {
				'type': 'ie',
				'version': match[1]
			};
		} else if (match = ua_header.match(/Version\/([\d\.]+).*Safari/i)) {
			this.browser = {
				'type': 'safari',
				'version': match[1]
			};
		} else {
			this.browser = {
				'type': false,
				'version': '0'
			}
		}

		// data (request body)
		if (request.method == 'POST' || request.method == 'PUT') {
			var form = new Formidable.IncomingForm();
			form.parse(request, function (err, fields, files) {
				this.data = fields;
				this.files = files;

				if (typeof this.callback == 'function') {
					this.callback();
				}
				this.__defineSetter__('callback', function (callback) {
					callback();
				});
			}.bind(this));
		} else {
			this.data = null;
			this.files = {};
			
			if (typeof this.callback == 'function') {
				this.callback();
			}
			this.__defineSetter__('callback', function (callback) {
				callback();
			});
		}
	},

	'getRawRequest': function () {
		return this.request;
	}
});