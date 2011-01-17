var Class = require(app.__dirname + 'modules/class.js').Class,
	RelativeDate = require(app.__dirname + '../lib/relativedate/relativedate.js');

var HttpResponse = exports.HttpResponse = Class.create({
	'initialize': function (response) {
		this._head_sent = false;

		this.response = response;
		this.status = 200;
		this.headers = {};
		this.cookies = [];
	},

	'isHeadSent': function () {
		return this._head_sent;
	},

	'getHeader': function (key) {
		return this.headers[key.toLowerCase()] || null;
	},

	'setHeader': function (key, value) {
		this.headers[key.toLowerCase()] = value;
	},

	'setHeaders': function (headers) {
		for (var i in headers) {
			if (headers.hasOwnProperty(i)) {
				this.headers[i] = headers[i];
			}
		}
	},

	'setCookie': function (key, value, expires, path, domain, secure, httponly) {
		this.cookies.push({
			'key': key,
			'value': value,
			'expires': RelativeDate.parse(expires, 'toUTCString').replace(/, (\d+) (\w+) (\d+) /, ', $1-$2-$3 '),
			'path': path || '/',
			'domain': domain,
			'secure': secure,
			'httponly': httponly
		});
	},

	'writeHead': function () {
		var headers = [];
		var i, ii, header;
		ii = this.headers;
		for (var i in ii) {
			if (ii.hasOwnProperty(i)) {
				header = ii[i];
				headers.push([i.toLowerCase(), header]);
			}
		}

		if (this.cookies.length > 0) {
			var cookies = this.cookies,
				cookie;
			for (var i = 0, ii = cookies.length; i < ii; ++i) {
				header = cookies[i];
				cookie = [];
				cookie.push(header.key + '=' + header.value);
				if (header.expires) {
					cookie.push('expires=' + header.expires);
				}
				if (header.path) {
					cookie.push('path=' + header.path);
				}
				if (header.domain) {
					cookie.push('domain=' + header.domain);
				}
				if (header.secure) {
					cookie.push('secure');
				}
				if (header.httponly) {
					cookie.push('httponly');
				}
				headers.push(['set-cookie', cookie.join('; ')]);
			}
		}

		this.response.writeHead(this.status, headers);

		this._head_sent = true;
	},

	'write': function (content, encoding) {
		if (!this.isHeadSent()) {
			this.writeHead();
		}

		this.response.write(content, encoding);
	},

	'end': function () {
		if (!this.isHeadSent()) {
			this.writeHead();
		}

		this.response.end();
	}
});