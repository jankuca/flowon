/*global app*/

var EventEmitter = require('events').EventEmitter;

global.Form = EventEmitter.inherit(function (key, request) {
	this.key = key;
	this._request = request;
	this._errors = {};
	this._files = {};
	this.submitted = false;

	this.action = request.uri;
	this.method = 'post';
	
	var values = {};
	Object.defineProperty(this, 'values', {
		'get': function () {
			return values;
		},
		'set': function (value) {
			Object.keys(value).forEach(function (key) {
				values[key] = value[key];
			});
		},
	});

	var data = request.data;
	if (data !== null && data._form === key) {
		this.submitted = true;

		Object.keys(data).forEach(function (key) {
			values[key] = data[key];
		});		

		if (Object.keys(request.files).length !== 0) {
			this._files = request.files;
		}
	}
}, {
	'getFile': function (key) {
		return this._files[key] || null;
	},

	'error': function (key, message) {
		if (this._errors[key] === undefined) {
			this._errors[key] = [];
		}
		this._errors[key].push(message);
	},

	// RENDER

	'startTag': function (is_multipart, attrs) {
		if (arguments.length === 1 && typeof is_multipart !== 'boolean') {
			attrs = is_multipart;
			is_multipart = false;
		} else if (is_multipart === undefined) {
			is_multipart = false;
		}
		attrs = attrs || {};
		attrs.method = attrs.method || this.method;
		attrs.action = attrs.action || this.action;
		if (is_multipart) {
			attrs.enctype = 'multipart/form-data';
		}

		var tag = '<form';
		Object.keys(attrs).forEach(function (key) {
			tag += ' ' + key + '="' + attrs[key].replace(/"/g, '\\"') + '"';
		});
		tag += '>';

		return tag;
	},

	'endTag': function () {
		return '<input type="hidden" name="_form" value="' + this.key + '" /></form>';
	},

	'textInput': function (name, attrs) {
		attrs = attrs || {};
		attrs.name = attrs.name || name;
		attrs.type = attrs.type || 'text';
		attrs.value = this.values[attrs.name] || '';
		if (this._errors[name]) {
			attrs['class'] = attrs['class'] ? attrs['class'] + ' invalid' : 'invalid';
		}

		var tag = '<input';
		Object.keys(attrs).forEach(function (key) {
			tag += ' ' + key + '="' + attrs[key].replace(/"/g, '\\"') + '"';
		});
		tag += ' />';

		return tag;
	},

	'textArea': function (name, attrs) {
		attrs = attrs || {};
		attrs.name = attrs.name || name;
		var value = this.values[attrs.name] || '';
		if (this._errors[name]) {
			attrs['class'] = attrs['class'] ? attrs['class'] + ' invalid' : 'invalid';
		}

		var tag = '<textarea';
		Object.keys(attrs).forEach(function (key) {
			tag += ' ' + key + '="' + attrs[key].replace(/"/g, '\\"') + '"';
		});
		tag += '>' + value.replace('<', '&lt;').replace('>', '&gt;') + '</textarea>';

		return tag;
	},

	'fileInput': function (name, attrs) {
		attrs = attrs || {};
		attrs.name = attrs.name || name;
		attrs.type = attrs.type || 'file';
		if (this._errors[name]) {
			attrs['class'] = attrs['class'] ? attrs['class'] + ' invalid' : 'invalid';
		}

		var tag = '<input';
		Object.keys(attrs).forEach(function (key) {
			tag += ' ' + key + '="' + attrs[key].replace(/"/g, '\\"') + '"';
		});
		tag += ' />';

		return tag;
	},

	'radioList': function (name, options, item_tag_name, checked_value) {
		var out = [];
		options.forEach(function (option, o) {
			var tag = '<' + (item_tag_name || 'p') + '>';
			tag += '<label>';
			tag += '<input type="radio" name="' + name + '" value="' + option[0] + '"';
			if (this[name]) {
				tag += (this[name] === option[0]) ? ' checked="checked"' : '';
			} else {
				tag += ((checked_value === undefined && o === 0) || checked_value === option[0]) ? ' checked="checked"' : '';
			}
			tag += ' /> ';
			tag += option[1];
			tag += '</' + (item_tag_name || 'p') + '>';
			out.push(tag);
		}, this.values);
		return out.join('');
	},

	'selectBox': function (name, options, checked_value) {
		var tag = '<select name="' + name + '">';
		options.forEach(function (option, o) {
			tag += '<option value="' + option[0] + '"';
			if (this[name]) {
				tag += (this[name] === option[0]) ? ' selected="selected"' : '';
			} else {
				tag += ((checked_value === undefined && o === 0) || checked_value === option[0]) ? ' selected="selected"' : '';
			}
			tag += '>';
			tag += option[1];
			tag += '</option>';
		}, this.values);
		tag += '</select>';

		return tag;
	},

	'submitButton': function (label, attrs) {
		attrs = attrs || {};
		attrs.type = 'submit';

		var tag = '<button';
		Object.keys(attrs).forEach(function (key) {
			tag += ' ' + key + '="' + attrs[key].replace(/"/g, '\\"') + '"';
		});
		tag += '>';

		return tag + label + '</button>';
	},

	'inputErrors': function (key, tag_name, attrs) {
		var error = this._errors[key];
		if (!error) {
			return '';
		}

		attrs = attrs || {};

		var tag = '<' + tag_name;
		Object.keys(attrs).forEach(function (key) {
			tag += ' ' + key + '="' + attrs[key].replace(/"/g, '\\"') + '"';
		});
		tag += '>';

		return tag + error + '</' + tag_name + '>';
	},

	'validate': function (rules) {
		var values = this.values;
		return rules.every(function (rule) {
			var key = rule[0];
			if (key instanceof Array) {
				return key.every(function (key) {
					return rule[1].test(values[key]) || (rule[2] !== undefined && this.error(key, rule[2]) && false);
				}, this);
			} else {
				return rule[1].test(values[key]) || (rule[2] !== undefined && this.error(key, rule[2]) && false);
			}
		}, this);
	},
});

Object.defineProperty(Form.prototype, 'errors', {
	'get': function () {
		var errors = [];
		Object.keys(this._errors).forEach(function (key) {
			errors = errors.concat(this._errors[key].map(function (err) {
				return [key, err];
			}));
		}, this);
		return errors;
	},
	'set': function (value) {
	},
});

Form.PRESENT = /\S+/;
Form.NUMBER = /^\d+$/;
Form.NUMBER_FLOAT = /^(\d+(\.\d+)?|\.\d+)$/;
Form.EMAIL = /^[A-Z0-9\._%\-]+@[A-Z0-9\.\-]+\.[A-Z]{2,4}$/i;
