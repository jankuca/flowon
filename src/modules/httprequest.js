var Class = require(app.__dirname + 'modules/class.js').Class;

var HttpRequest = exports.HttpRequest = Class.create({
	'initialize': function (request) {
		this.request = request;
		this.method = request.method;
		this.headers = request.headers;

		// cookies
		this.cookies = {};
		var cookie_header = request.headers.cookie,
			fields = (cookie_header !== undefined) ? cookie_header.match(/[^=]+=[^=:;]*/g) : [];
		for (var i = 0, ii = fields.length; i < ii; ++i) {
			field = fields[i].split('=');
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
	}
});