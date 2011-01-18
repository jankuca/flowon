var rsplit = function (string, regex) {
	var result = regex.exec(string),
		retArr = [],
		first_idx,
		last_idx,
		first_bit;
	while (result !== null) {
		first_idx = result.index;
		last_idx = regex.lastIndex;
		if (first_idx !== 0) {
			first_bit = string.substring(0, first_idx);
			retArr.push(string.substring(0, first_idx));
			string = string.slice(first_idx);
		}
		retArr.push(result[0]);
		string = string.slice(result[0].length);
		result = regex.exec(string);
	}
	if (string !== '') {
		retArr.push(string);
	}
	return retArr;
};
var chop = function (string) {
	return string.substr(0, string.length - 1);
};
var extend = function (d, s) {
	for (var n in s) {
		if (s.hasOwnProperty(n)) {
			d[n] = s[n];
		}
	}
};

var EJS = function (options) {
	if (typeof options == 'string') {
		options = {
			'view': options
		};
	}
	this.set_options(options);
	if (options.precompiled) {
		this.template = {};
		this.template.controller = options.controller;
		var to_be_evaled = '/*' + this.name + '*/ ' + 
		'this.template.process = function (_CONTEXT,_VIEW) { ' +
			'try { ' +
				'var helpers = {}; ' +
				'for (var key in _VIEW) { ' +
					'if (_VIEW.__proto__[key] !== undefined && typeof _VIEW[key] === \'function\') { ' +
						'helpers[key] = _VIEW[key].bind(_VIEW); ' +
					'} ' +
				'} ' +
				'delete key; ' +
				'with (helpers) { ' +
					'delete helpers; ' +
					'with (_CONTEXT) { ' +
						'delete _CONTEXT; ' +
						options.precompiled + ' ' +
						'return ___ViewO.join(\'\'); ' +
					'} ' +
				'} ' +
			'} catch (e) { ' +
				'e.lineNumber = null; ' +
				'throw e; ' +
			'} ' +
		'};';
		eval(to_be_evaled);
		EJS.update(this.name, this);
		return;
	}

	var template = new EJS.Compiler(this.text, this.type);
	template.compile(options, this.name);
	template.controller = options.controller;
	EJS.update(this.name, this);
	this.template = template;
};

EJS.prototype = {
	'render': function (object, extra_helpers) {
		object = object || {};
		this._extra_helpers = extra_helpers;
		var v = new EJS.Helpers(object, extra_helpers || {}, this.template.controller);
		return this.template.process.call(object, object, v);
	},
	'out': function () {
		return this.template.out;
	},
	'set_options': function (options) {
		this.type = options.type || EJS.type;
		this.cache = (options.cache !== null) ? options.cache: EJS.cache;
		this.text = options.text || null;
		this.name =	options.name || null;
		this.ext = options.ext || EJS.ext;
		this.extMatch = new RegExp(this.ext.replace(/\./, '\\.'));
	}
};
EJS.endExt = function (path, match) {
	if (!path) {
		return null;
	}
	match.lastIndex = 0;
	return path + (match.test(path) ? '' : this.ext);
};
EJS.Scanner = function (source, left, right) {
	extend(this, {
		'left_delimiter': left + '%',
		'right_delimiter': '%' + right,
		'double_left': left + '%%',
		'double_right': '%%' + right,
		'left_equal': left + '%=',
		'left_comment': left + '%#'
	});
	this.SplitRegexp = (left == '[') ? /(\[%%)|(%%\])|(\[%=)|(\[%#)|(\[%)|(%\]\n)|(%\])|(\n)/ : new RegExp('(' + this.double_left + ')|(%%' + this.double_right + ')|(' + this.left_equal + ')|(' + this.left_comment + ')|(' + this.left_delimiter + ')|(' + this.right_delimiter + '\n)|(' + this.right_delimiter + ')|(\n)');
	this.source = source;
	this.stag = null;
	this.lines = 0;
};
EJS.Scanner.to_text = function (input) {
	if (input === null || input === undefined) {
		return '';
	}
	if (input instanceof Date) {
		return input.toDateString();
	}
	if (input.toString) {
		return input.toString();
	}
	return '';
};
EJS.Scanner.prototype = {
	'scan': function (block) {
		var regex = this.SplitRegexp;
		if (this.source !== '') {
			var source_split = rsplit(this.source, /\n/);
			for (var i = 0, ii = source_split.length; i < ii; ++i) {
				var item = source_split[i];
				this.scanline(item, regex, block);
			}
		}
	},
	'scanline': function (line, regex, block) {
		++this.lines;
		var line_split = rsplit(line, regex);
		for (var i = 0, ii = line_split.length; i < ii; ++i) {
			var token = line_split[i];
			if (token === null) {
				continue;
			}
			
			try {
				block(token, this);
			} catch (e) {
				throw {
					'type': 'EJS.Scanner',
					'line': this.lines
				};
			}
		}
	}
};
EJS.Buffer = function (pre_cmd, post_cmd) {
	this.line = [];
	this.script = '';
	this.pre_cmd = pre_cmd;
	this.post_cmd = post_cmd;
	for (var i = 0, ii = this.pre_cmd.length; i < ii; ++i) {
		this.push(pre_cmd[i]);
	}
};
EJS.Buffer.prototype = {
	'push': function (cmd) {
		this.line.push(cmd);
	},
	'cr': function () {
		this.script = this.script + this.line.join('; ');
		this.line = [];
		this.script = this.script + "\n";
	},
	'close': function () {
		if (this.line.length > 0) {
			for (var i = 0, ii = this.post_cmd.length; i < ii; ++i) {
				this.push(this.post_cmd[i]);
			}
			this.script = this.script + this.line.join('; ');
			this.line = null;
		}
	}
};
EJS.Compiler = function (source, left) {
	this.pre_cmd = ['var ___ViewO = [];'];
	this.post_cmd = [];
	this.source = ' ';
	if (source !== null) {
		if (typeof source == 'string') {
			source = source.replace(/\r\n/g, "\n");
			source = source.replace(/\r/g,	"\n");
			this.source = source;
		} else if (source.innerHTML) {
			this.source = source.innerHTML;
		}
		if (typeof this.source != 'string') {
			this.source = '';
		}
	}
	left = left || '<';
	var right = '>';
	switch (left) {
	case '[':
		right = ']';
		break;
	case '<':
		break;
	default:
		throw left + ' is not a supported deliminator';
	}
	this.scanner = new EJS.Scanner(this.source, left, right);
	this.out = '';
};
EJS.Compiler.prototype = {
	'compile': function (options, name) {
		options = options || {};
		this.out = '';
		var put_cmd = '___ViewO.push(',
			insert_cmd = put_cmd,
			buff = new EJS.Buffer(this.pre_cmd, this.post_cmd),
			content = '';
		var clean = function (content) {
			content = content.replace(/\\/g, '\\\\');
			content = content.replace(/\n/g, '\\n');
			content = content.replace(/"/g,	'\\"');
			return content;
		};
		this.scanner.scan(function (token, scanner) {
			if (scanner.stag === null) {
				switch (token) {
				case '\n':
					content = content + "\n";
					buff.push(put_cmd + '"' + clean(content) + '");');
					buff.cr();
					content = '';
					break;
				case scanner.left_delimiter:
				case scanner.left_equal:
				case scanner.left_comment:
					scanner.stag = token;
					if (content.length > 0) {
						buff.push(put_cmd + '"' + clean(content) + '")');
					}
					content = '';
					break;
				case scanner.double_left:
					content = content + scanner.left_delimiter;
					break;
				default:
					content = content + token;
				}
			} else {
				switch (token) {
				case scanner.right_delimiter:
					switch (scanner.stag) {
					case scanner.left_delimiter:
						if (content[content.length - 1] == '\n') {
							content = chop(content);
							buff.push(content);
							buff.cr();
						} else {
							buff.push(content);
						}
						break;
					case scanner.left_equal:
						buff.push(insert_cmd + '(EJS.Scanner.to_text(' + content + ')))');
						break;
					}
					
					scanner.stag = null;
					content = '';
					break;
				case scanner.double_right:
					content = content + scanner.right_delimiter;
					break;
				default:
					content = content + token;
					break;
				}
			}
		});
		if (content.length > 0) {
			buff.push(put_cmd + '"' + clean(content) + '")');
		}
		buff.close();
		this.out = buff.script + ';';
		//var to_be_evaled = '/*' + name + '*/this.process = function (_CONTEXT,_VIEW) {	try { with(_VIEW) {	with (_CONTEXT) { ' + this.out + " return ___ViewO.join('');}}}catch(e) { e.lineNumber=null;throw e;}};";
		var to_be_evaled = '/*' + this.name + '*/ ' + 
		'this.process = function (_CONTEXT,_VIEW) { ' +
			'try { ' +
				'var helpers = {}; ' +
				'for (var key in _VIEW) { ' +
					'if (_VIEW.__proto__[key] !== undefined && typeof _VIEW[key] === \'function\') { ' +
						'helpers[key] = _VIEW[key].bind(_VIEW); ' +
					'} ' +
				'} ' +
				'delete key; ' +
				'with (helpers) { ' +
					'delete helpers; ' +
					'with (_CONTEXT) { ' +
						'delete _CONTEXT; ' +
						this.out + ' ' +
						'return ___ViewO.join(\'\'); ' +
					'} ' +
				'} ' +
			'} catch (e) { ' +
				'e.lineNumber = null; ' +
				'throw e; ' +
			'} ' +
		'};';
		eval(to_be_evaled);
	}
};
EJS.config = function (options) {
	EJS.cache = (options.cache !== null) ? options.cache: EJS.cache;
	EJS.type = (options.type !== null) ? options.type: EJS.type;
	EJS.ext = (options.ext !== null) ? options.ext: EJS.ext;
	var templates_directory = EJS.templates_directory || {};
	EJS.templates_directory = templates_directory;
	EJS.get = function (path, cache) {
		if (cache === false) {
			return null;
		}
		if (templates_directory[path]) {
			return templates_directory[path];
		}
		return null;
	};
	EJS.update = function (path, template) {
		if (path === null) {
			return;
		}
		templates_directory[path] = template;
	};
	EJS.INVALID_PATH = -1;
};
EJS.config({
	'cache': true,
	'type': '<',
	'ext': '.ejs'
});
EJS.Helpers = function (data, extras, controller) {
	this._data = data;
	this._extras = extras;
	this.controller = controller;
	extend(this, extras);
};
EJS.Helpers.prototype = {
	'view': function (options, data, helpers) {
		if (!helpers) {
			helpers = this._extras;
		}
		if (!data) {
			data = this._data;
		}
		return new EJS(options).render(data, helpers);
	},
	'to_text': function (input, null_text) {
		if (input === null || input === undefined) {
			return null_text || '';
		}
		if (input instanceof Date) {
			return input.toDateString();
		}
		if (input.toString) {
			return input.toString().replace(/\n/g, '<br />').replace(/''/g, "'");
		}
		return '';
	}
};


exports.EJS = EJS;