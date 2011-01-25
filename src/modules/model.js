var Class = require(app.__dirname + 'modules/class.js').Class;

var Model = Class.create({
	'fields': [],

	'initialize': function (doc) {
		this.doc = doc || {};
		this._exists = !!this.doc._id;

		if (!doc) {
			return;
		}

		for (var key in doc) {
			if (doc.hasOwnProperty(key) && key.search(':') > -1) {
				this[key] = doc[key];
			}
		}
	},

	'embed': function (obj, key) {
		if (obj === undefined) {
			throw 'Invalid state';
		}

		var embeddable = null;
		var obj_many = false;

		var e, ee;
		var embeds_one = this.__proto__.embeds_one;
		for (e = 0, ee = embeds_one.length; e < ee; ++e) {
			if ((!key || embeds_one[e][1] == key) && obj instanceof embeds_one[e][0]) {
				embeddable = embeds_one[e];
				break;
			}
		}
		if (embeddable === null) {
			var embeds_many = this.__proto__.embeds_many;
			for (e = 0, ee = embeds_many.length; e < ee; ++e) {
				if ((!key || embeds_many[e][1] == key) && obj instanceof embeds_many[e][0]) {
					embeddable = embeds_many[e];
					obj_many = true;
					break;
				}
			}
		}
		if (embeddable === null) {
			throw 'Object not supported';
		}

		if (key === undefined) {
			key = embeddable[1];
		}

		if (obj_many) {
			if (eval('this.doc.' + key + ' === undefined')) {
				eval('this.doc.' + key + ' = [];');
			}
			eval('this.doc.' + key + '.push(obj.doc)');
		} else {
			eval('this.doc.' + key + ' = obj.doc;');
		}

		return this;
	},

	'give': function (obj, key) {
		if (obj === undefined || obj.doc === undefined) {
			throw 'Invalid state';
		}
		if (obj.getId() === null) {
			throw 'The document has not been saved yet.';
		}

		var embeddable = null;
		var obj_many = false;
		var e, ee;
		var has_one = this.__proto__.has_one;
		for (e = 0, ee = has_one.length; e < ee; ++e) {
			if ((key === undefined || has_one[e][1] == key) && obj instanceof has_one[e][0]) {
				embeddable = has_one[e];
				break;
			}
		}
		if (embeddable === null) {
			var has_many = this.__proto__.has_many;
			for (e = 0, ee = has_many.length; e < ee; ++e) {
				if ((key === undefined || has_many[e][1] == key) && obj instanceof has_many[e][0]) {
					embeddable = has_many[e];
					obj_many = true;
					break;
				}
			}
		}
		if (embeddable === null) {
			throw 'Object not supported';
		}
		
		if (key === undefined) {
			key = embeddable[1];
		}

		var parts = key.split('.'), cur = [];
		if (parts.length > 1) {
			var p, pp;
			for (p = 0, pp = parts.length - 1; p < pp; ++p) {
				cur.push(parts[p]);
				if (eval('this.doc.' + cur.join('.') + ' === undefined')) {
					eval('this.doc.' + cur.join('.') + ' = {}');
				}
			}
		}
		if (obj_many) {
			if (eval('this.doc.' + key + ' === undefined')) {
				eval('this.doc.' + key + ' = [];');
			}
			eval('this.doc.' + key + '.push(obj.getId());');
		} else {
			eval('this.doc.' + key + ' = obj.getId();');
		}

		return this;
	},

	'exists': function () {
		return this._exists;
	},

	'getId': function (stringify) {
		return (stringify) ? this.doc._id.toString() || '' : this.doc._id || null;
	},

	'setId': function (id) {
		if (typeof id == 'string') {
			id = app.db.pkFactory(id);
		}
		this.doc._id = id;
	},

	'getFields': function (keys) {
		var output = {};

		var fields = keys || this.fields;
		for (var i = 0, ii = fields.length; i < ii; ++i) {
			var key = fields[i],
				default_value = null;
			if (key instanceof Array) {
				default_value = key[1];
				key = key[0];
			}
			if (key.search(':') == -1) {
				throw 'Invalid field name "' + key + '"';
			}

			output[key] = (this[key] !== undefined) ? this[key] : default_value;
		}

		return output;
	},

	'get': function (key, selector, options, callback) {
		if (arguments[3] === undefined) {
			if (typeof arguments[2] == 'function') {
				callback = arguments[2];
				options = {};
			}
		}
		if (arguments[2] === undefined) {
			if (typeof arguments[1] == 'function') {
				callback = arguments[1];
				options = {};
				selector = {};
			}
		}

		var embeddable = null;
		var embedded = false;
		var obj_many = false;

		var e, ee;
		var has_one = this.__proto__.has_one;
		for (e = 0, ee = has_one.length; e < ee; ++e) {
			if (has_one[e][1] == key) {
				embeddable = has_one[e];
				break;
			}
		}
		if (embeddable === null) {
			var has_many = this.__proto__.has_many;
			for (e = 0, ee = has_many.length; e < ee; ++e) {
				if (has_many[e][1] == key) {
					embeddable = has_many[e];
					obj_many = true;
					break;
				}
			}
		}
		if (embeddable === null) {
			embedded = true;
			var embeds_one = this.__proto__.embeds_one;
			for (e = 0, ee = embeds_one.length; e < ee; ++e) {
				if (embeds_one[e][1] == key) {
					embeddable = embeds_one[e];
					break;
				}
			}
		}
		if (embeddable === null) {
			var embeds_many = this.__proto__.embeds_many;
			for (e = 0, ee = embeds_many.length; e < ee; ++e) {
				if (embeds_many[e][1] == key) {
					embeddable = embeds_many[e];
					obj_many = true;
					break;
				}
			}
		}
		if (embeddable === null) {
			throw 'Object not supported';
		}

		if (!embedded && arguments[1] === undefined) {
			throw 'Invalid state';
		}

		var _getIds = function (key) {
			var keys = key.split('.');
			var val = this.doc;
			for (var e = 0; e < keys.length; ++e) {
				if (val === undefined) {
					return [];
				}
				val = val[keys[e]];
			}
			return val || [];
		}.bind(this);
		var ids = _getIds(key);

		if (!embedded) {
			selector._id = (obj_many) ? { $in: ids } : ids;
			selector['date:deleted'] = { $exists: false };
			options.one = !obj_many;

			embeddable[0][obj_many ? 'all' : 'one'](selector, options, callback);
		} else {
			var res;
			if (ids === undefined) {
				res = (obj_many) ? [] : null;
			} else {
				res = [];
				for (var r = 0, rr = ids.length; r < rr; ++r) {
					res.push(new embeddable[0](ids[r]));
				}
				if (!obj_many) {
					res = res[0] || null;
				}
			}

			if (typeof callback == 'function') {
				callback(res);
			}
			return res;
		}
	},

	'update': function (fields, callback) {
		for (var key in fields) {
			if (fields.hasOwnProperty(key) && key.search(':') > - 1) {
				this[key] = fields[key];
			}
		}
		this.save(callback);
	},
	'updateTimestamp': function (key) {
		this[key] = Math.round(new Date().getTime() / 1000);
	},

	'save': function (callback) {
		for (var key in this) {
			if (this.hasOwnProperty(key) && key.search(':') > -1) {
				this.doc[key] = this[key];
			}
		}

		if (!this.constructor.is_embedded) {
			app.db.collection(this.collection_name, function (err, collection) {
				if (err) {
					throw err;
				}

				collection.save(this.doc, { 'options': { 'insert': !this.exists() } }, function (err) {
					if (err) {
						throw err;
					}

					if (typeof callback === 'function') {
						callback();
					}
				});
			}.bind(this));
		} else {
			if (typeof callback === 'function') {
				callback();
			}
		}
	},

	'remove': function (callback) {
		if (!this.exists()) {
			if (typeof callback == 'function') {
				callback(null);
			}
			return;
		}

		app.db.collection(this.collection_name, function (err, collection) {
			collection.remove({ _id: this.getId() }, callback);
		});
	}
});

Model.one = function (selector, options, callback) {
	if (arguments[2] === undefined) {
		if (typeof arguments[1] == 'function') {
			callback = arguments[1];
			options = {};
		}
	}
	if (options instanceof Array) {
		options = {
			'fields': options
		};
	}
	if (typeof selector == 'string') {
		selector = {
			_id: selector
		};
	}

	options.one = true;

	this.all(selector, options, callback);
};

Model.all = function (selector, options, callback) {
	if (arguments[2] === undefined) {
		if (typeof arguments[1] == 'function') {
			callback = arguments[1];
			options = {};
		}
	}
	if (options instanceof Array) {
		options = {
			'fields': options
		};
	}

	if (selector._id !== undefined && typeof selector._id == 'string') {
		selector._id = app.db.pkFactory(selector._id);
	}

	var one = !!options.one;
	if (one) {
		delete options.one;
	}
	if (options.sort === undefined) {
		options.sort = 'date:created';
	}

	app.db.collection(this.collection_name, function (err, collection) {
		collection[one ? 'findOne' : 'find'](selector || {}, options, function (err, docs) {
			if (!one) {
				docs.toArray(function (err, docs) {
					var res = [];
					for (var d = 0, dd = docs.length; d < dd; ++d) {
						res.push(new this(docs[d]));
					}

					callback(res);
				}.bind(this));
			} else {
				callback(new this(docs));
			}
		}.bind(this));
	}.bind(this));
};

var Factory = exports.Factory = {
	'models': {},

	'create': function (model_name, collection_name, spec) {
		if (model_name === undefined || collection_name === undefined) {
			throw 'Invalid state';
		}
		if (typeof collection_name != 'string') {
			if (typeof collection_name != 'object') {
				throw 'Invalid state';
			}
			spec = collection_name;
			collection_name = false;
		}

		spec.name = model_name;
		spec.collection_name = collection_name;

		if (spec.embeds_one === undefined) {
			spec.embeds_one = [];
		} else if (spec.embeds_one.length && spec.embeds_one[0] instanceof Array === false) {
			spec.embeds_one = [spec.embeds_one];
		}

		if (spec.embeds_many === undefined) {
			spec.embeds_many = [];
		} else if (spec.embeds_many.length && spec.embeds_many[0] instanceof Array === false) {
			spec.embeds_many = [spec.embeds_many];
		}

		if (spec.has_one === undefined) {
			spec.has_one = [];
		} else if (spec.has_one.length && spec.has_one[0] instanceof Array === false) {
			spec.has_one = [spec.has_one];
		}

		if (spec.has_many === undefined) {
			spec.has_many = [];
		} else if (spec.has_many.length && spec.has_many[0] instanceof Array === false) {
			spec.has_many = [spec.has_many];
		}

		spec.embedded_in = [];
		spec.balongs_to = [];

		var model = Class.create(Model, spec);
		model.NAME = model_name;
		model.embeds_one = spec.embeds_one;
		model.embeds_many = spec.embeds_many;		
		model.has_one = spec.has_one;
		model.has_many = spec.has_many;
		model.embedded_in = [];
		model.belongs_to = [];
		model.collection_name = collection_name;
		model.is_embedded = !collection_name;

		if (!model.is_embedded) {
			// add the static methods as well
			for (var method in Model) {
				if (Model.hasOwnProperty(method) && typeof Model[method] == 'function') {
					model[method] = Model[method];
				}
			}
		}

		var i, ii;
		ii = spec.embeds_one.length;
		if (ii) {
			for (i = 0; i < ii; ++i) {
				spec.embeds_one[i][0].embedded_in.push(model);
				//spec.embeds_one[i][0].getPrototype().embedded_in.push(model);
			}
		}
		ii = spec.embeds_many.length;
		if (ii) {
			for (i = 0; i < ii; ++i) {
				spec.embeds_many[i][0].embedded_in.push(model);
				//spec.embeds_many[i][0].getPrototype().embedded_in.push(model);
			}
		}
		ii = spec.has_one.length;
		if (ii) {
			for (i = 0; i < ii; ++i) {
				spec.has_one[i][0].belongs_to.push(model);
				//spec.has_one[i][0].getPrototype().belongs_to.push(model);
			}
		}
		ii = spec.has_many.length;
		if (ii) {
			for (i = 0; i < ii; ++i) {
				spec.has_many[i][0].belongs_to.push(model);
				//spec.has_many[i][0].getPrototype().belongs_to.push(model);
			}
		}

		Factory.models[model_name] = model;
		return model;
	}
};