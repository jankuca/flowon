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
	});

	if (request.data !== null) {
		this.submitted = true;

		var data = request.data;
		Object.getOwnPropertyNames(data).forEach(function (key) {
			values[key] = data[key];
		});
	}
	if (Object.keys(request.files).length !== 0) {
		this.submitted = true;
		this._files = request.files;
	}
}, {
	'getFile': function (key) {
		return this._files[key] || null;
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
		Object.getOwnPropertyNames(attrs).forEach(function (key) {
			tag += ' ' + key + '="' + attrs[key].replace(/"/g, '\\"') + '"';
		});
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
		Object.getOwnPropertyNames(attrs).forEach(function (key) {
			tag += ' ' + key + '="' + attrs[key].replace(/"/g, '\\"') + '"';
		});
		tag += ' />';

		return tag;
	},

	'fileInput': function (name, attrs) {
		attrs = attrs || {};
		attrs.name = attrs.name || name;
		attrs.type = attrs.type || 'file';

		var tag = '<input';
		Object.getOwnPropertyNames(attrs).forEach(function (key) {
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

	'submitButton': function (label, attrs) {
		attrs = attrs || {};
		attrs.type = 'submit';
		attrs.name = '_form';
		attrs.value = this.key;

		var tag = '<button';
		Object.getOwnPropertyNames(attrs).forEach(function (key) {
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
		Object.getOwnPropertyNames(attrs).forEach(function (key) {
			tag += ' ' + key + '="' + attrs[key].replace(/"/g, '\\"') + '"';
		});
		tag += '>';

		return tag + error + '</' + tag_name + '>';
	}
});