global.ApiController = global.Controller.inherit(function () {
	this.data = null;
	this.format = 'json';
}, {
	'render': function (status) {
		if (status !== undefined) {
			this._response.status = status;
		}
		if (this.data !== null) {
			this.header('content-type', 'application/json; charset=UTF-8');
			this._response.write(JSON.stringifyFormatted(this.data));
		}
		this._response.end();
	},
	'terminate': function (status, message) {
		this.data = {
			'error': message || true,
		};
		this.render(status);
	},
});

JSON.stringifyFormatted = function (input) {
	var tab = '	',
		output = '',
		indent_level = 0,
		in_string = false,
		json = JSON.stringify(input),
		c, cc, char;
	
	var str_repeat = function (str, count) {
		var out = '';
		for (var i = 0; i < count; ++i) {
			out += str;
		}
		return out;
	};

	for (c = 0, cc = json.length; c < cc; ++c) {
		char = json[c];
		switch (char) {
		case '{':
		case '[':
			output += char + (!in_string ? "\n" + str_repeat(tab, ++indent_level) : '');
			break;
		case '}':
		case ']':
			output += (!in_string ? "\n" + str_repeat(tab, --indent_level) : '') + char;
			break;
		case ',':
			output += (!in_string) ? ",\n" + str_repeat(tab, indent_level) : char;
			break;
		case ':':
			output += (!in_string) ? ": " : char;
			break;
		case '"':
			if (c > 0 && json[c-1] != '\\') {
				in_string = !in_string;
			}
		default:
			output += char;
			break;
		}
	}

	return output;
};