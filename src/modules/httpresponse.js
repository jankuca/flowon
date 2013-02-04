/*global app*/

var RelativeDate = require('relativedate/relativedate.js');

var HttpResponse = module.exports.HttpResponse = Function.inherit(function (response) {
	this._head_sent = false;
	this._body_sent = false;

	this.response = response;
	this.status = 200;
	this.headers = {};
	this.cookies = [];
}, {
	'isHeadSent': function () {
		return this._head_sent;
	},

	'isBodySent': function () {
		return this._body_sent;
	},

	'getHeader': function (key) {
		return this.headers[key.toLowerCase()] || null;
	},

	'setHeader': function (key, value) {
		this.headers[key.toLowerCase()] = value.toString();
	},

	'setHeaders': function (headers) {
		Object.keys(headers).forEach(function (key) {
			this.headers[key.toLowerCase()] = headers[key].toString();
		}, this);
	},

	'setCookie': function (key, value, expires, path, domain, secure, httponly) {
		this.cookies.push({
			'key': key,
			'value': value,
			'expires': RelativeDate.parse(expires, 'toGMTString').replace(/, (\d+) (\w+) (\d+) /, ', $1-$2-$3 '),
			'path': path || '/',
			'domain': domain,
			'secure': secure,
			'httponly': httponly
		});
	},

	'writeHead': function () {
		var headers = [];
		Object.getOwnPropertyNames(this.headers).forEach(function (key) {
			headers.push([key.toLowerCase(), this.headers[key]]);
		}, this);

		this.cookies.forEach(function (obj) {
			var cookie = [obj.key + '=' + obj.value];
			if (obj.expires) {
				cookie.push('expires=' + obj.expires);
			}
			if (obj.path) {
				cookie.push('path=' + obj.path);
			}
			if (obj.$domain) {
				cookie.push('domain=' + obj.$domain);
			}
			if (obj.secure) {
				cookie.push('secure');
			}
			if (obj.httponly) {
				cookie.push('httponly');
			}
			headers.push(['set-cookie', cookie.join('; ')]);
		});

		this.response.writeHead(this.status, headers);
		this._head_sent = true;
	},

	'write': function (content, encoding) {
		if (!this.isHeadSent()) {
			this.writeHead();
		}
		if (!this.isBodySent()) {
			this.response.write(content, encoding);
		}
	},

	'end': function () {
		if (!this.isHeadSent()) {
			this.writeHead();
		}
		if (!this.isBodySent()) {
			this.response.end();
		}
		this._body_sent = true;
	},
});
