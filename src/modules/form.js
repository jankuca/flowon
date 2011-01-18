var Class = require(app.__dirname + 'modules/class.js').Class;

var Form = exports.Form = Class.create({
	'initialize': function (key, request) {
		this.key = key;
		this._request = request;
		this._errors = {};

		this.action = request.uri;
		this.method = 'post';

		var data = request.data;
		if (data !== null) {
			this._submitted = true;
			for (var i in data) {
				if (data.hasOwnProperty(i)) {
					if (this[i] !== undefined) {
						throw 'Forbidden input name: ' + i;
					}
					this[i] = data;
				}
			}
		}
	},

	'isSubmitted': function () {
		return this._submitted;
	},

	'getValues': function () {
		return this;
	},

	'error': function (key, message) {
		this._errors[key] = message;
	},

	'getErrors': function (key) {
		return (key === undefined) ? this._errors : this._errors[key] || [];
	},

	// RENDER

	'startTag': function (attrs) {
		attrs = attrs || {};
		attrs.method = attrs.method || this.method;
		attrs.action = attrs.action || this.action;

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
		
		var tag = '<input';
		for (var key in attrs) {
			if (attrs.hasOwnProperty(key)) {
				tag += ' ' + key + '="' + attrs[key].replace(/"/g, '\\"') + '"';
			}
		}
		tag += ' />';

		return tag;
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