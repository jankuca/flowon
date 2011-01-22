var Class = require(app.__dirname + 'modules/class.js').Class;

var Form = exports.Form = Class.create(app.Emitter, {
	'initialize': function (key, request) {
		this.key = key;
		this._request = request;
		this._errors = {};
		this._files = null;

		this.action = request.uri;
		this.method = 'post';

		if (request.data !== null) {
			this._submitted = true;

			var data = request.data;
			for (var i in data) {
				if (data.hasOwnProperty(i)) {
					this[i] = data[i];
				}
			}
		}
		if (request.files !== null) {
			this._submitted = true;
			this._files = request.files;
		}
	},

	'isSubmitted': function () {
		return this._submitted;
	},

	'getValues': function () {
		return this;
	},

	'getFile': function (key) {
		if (this._files === null || this._files[key] === undefined) {
			return null;
		}
		return this._files[key];
	},

	'error': function (key, message) {
		this._errors[key] = message;
	},

	'getErrors': function (key) {
		return (key === undefined) ? this._errors : this._errors[key] || [];
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
		for (var key in attrs) {
			if (attrs.hasOwnProperty(key)) {
				tag += ' ' + key + '="' + attrs[key].replace(/"/g, '\\"') + '"';
			}
		}
		tag += '>';

		return tag;
	},

	'endTag': function () {
		return '</form>';
	},

	'textInput': function (name, attrs) {
		attrs = attrs || {};
		attrs.name = attrs.name || name;
		attrs.type = attrs.type || 'text';
		attrs.value = this[attrs.name] || '';
		
		var tag = '<input';
		for (var key in attrs) {
			if (attrs.hasOwnProperty(key)) {
				tag += ' ' + key + '="' + attrs[key].replace(/"/g, '\\"') + '"';
			}
		}
		tag += ' />';

		return tag;
	},

	'fileInput': function (name, attrs) {
		attrs = attrs || {};
		attrs.name = attrs.name || name;
		attrs.type = attrs.type || 'file';

		var tag = '<input';
		for (var key in attrs) {
			if (attrs.hasOwnProperty(key)) {
				tag += ' ' + key + '="' + attrs[key].replace(/"/g, '\\"') + '"';
			}
		}
		tag += ' />';

		return tag;
	},

	'radioList': function (name, options, item_tag_name, checked_value) {
		var out = [];

		for (var o = 0, oo = options.length; o < oo; ++o) {
			var option = options[o];
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
		}

		return out.join('');
	},

	'submitButton': function (label, attrs) {
		attrs = attrs || {};
		attrs.type = 'submit';
		attrs.name = '_form';
		attrs.value = this.key;

		tag = '<button';
		for (var key in attrs) {
			if (attrs.hasOwnProperty(key)) {
				tag += ' ' + key + '="' + attrs[key].replace(/"/g, '\\"') + '"';
			}
		}
		tag += '>';

		return tag + label + '</button>';
	},

	'inputErrors': function (key, tag_name, attrs) {
		var error = this._errors[key];
		if (!error) {
			return '';
		}

		attrs = attrs || {};

		tag = '<' + tag_name;
		for (var key in attrs) {
			if (attrs.hasOwnProperty(key)) {
				tag += ' ' + key + '="' + attrs[key].replace(/"/g, '\\"') + '"';
			}
		}
		tag += '>';

		return tag + error + '</' + tag_name + '>';
	}
});