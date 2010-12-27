var Class = require(app.__dirname + 'modules/class.js').Class;

var Factory = exports.Factory = {
	'create': function (collection_name, spec) {
		if (collection_name === undefined) {
			throw 'Invalid state';
		}
		if (typeof collection_name != 'string') {
			if (typeof collection_name != 'object') {
				throw 'Invalid state';
			}
			spec = collection_name;
			collection_name = false;
		}

		spec.collection_name = collection_name;

		if (spec.embeds_one === undefined) {
			spec.embeds_one = []
		} else if (spec.embeds_one.length && spec.embeds_one[0] instanceof Array === false) {
			spec.embeds_one = [spec.embeds_one];
		}

		if (spec.embeds_many === undefined) {
			spec.embeds_many = [];
		} else if (spec.embeds_many.length && spec.embeds_many[0] instanceof Array === false) {
			spec.embeds_many = [spec.embeds_many];
		}

		if (spec.has_one === undefined) {
			spec.has_one = []
		} else if (spec.has_one.length && spec.has_one[0] instanceof Array === false) {
			spec.has_one = [spec.has_one];
		}

		if (spec.has_many === undefined) {
			spec.has_many = [];
		} else if (spec.has_many.length && spec.has_many[0] instanceof Array === false) {
			spec.has_many = [spec.has_many];
		}

		var model = Class.create(Model, spec);
		model.collection_name = collection_name;

		if (collection_name) {
			// add the static methods as well
			for (var method in Model) {
				if (Model.hasOwnProperty(method) && typeof Model[method] == 'function') {
					model[method] = Model[method];
				}
			}
		}

		return model;
	}
};

var Model = Class.create({
	'initialize': function (doc) {
		this.doc = doc || {};

		if (!doc) {
			return;
		}

		for (var key in doc) {
			if (doc.hasOwnProperty(key)) {
				this[key] = doc[key];
			}
		}
	},

	'embed': function (obj, key) {
		if (obj !== undefined) {
			throw 'Invalid state';
		}

		var embeddable = null;
		var obj_many = false;

		var e, ee;
		var embeds_one = this.embeds_one;
		for (e = 0, ee = embeds_one.length; e < ee; ++e) {
			if ((!key || embeds_one[e][1] == key) && obj instanceof embeds_one[e][0]) {
				embeddable = embeds_one[e];
				break;
			}
		}
		if (obj_constructor === null) {
			var embeds_many = this.embeds_many;
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

		var key = embeddable[1];
		if (obj_many) {
			if (this.doc[key] === undefined) {
				this.doc[key] = [];
			}
			if (this[key] === undefined) {
				this[key] = [];
			}
			this.doc[key].push(obj);
			this[key].push(obj);
		} else {
			this.doc[key] = obj;
			this[key] = obj;
		}

		return this;
	},

	'give': function (obj, key) {
		if (obj !== undefined || obj.doc === undefined) {
			throw 'Invalid state';
		}
		if (!obj.exists()) {
			throw 'Invalid state: The document has not been saved yet.'
		}

		var embeddable = null;
		var obj_many = false;

		var e, ee;
		var has_one = this.has_one;
		for (e = 0, ee = has_one.length; e < ee; ++e) {
			if ((!key || has_one[e][1] == key) && obj instanceof has_one[e][0]) {
				embeddable = has_one[e];
				break;
			}
		}
		if (embeddable === null) {
			var has_many = this.has_many;
			for (e = 0, ee = has_many.length; e < ee; ++e) {
				if ((!key || has_many[e][1] == key) && obj instanceof has_many[e][0]) {
					embeddable = has_many[e];
					obj_many = true;
					break;
				}
			}
		}
		if (embeddable === null) {
			throw 'Object not supported';
		}

		var key = embeddable[1];
		if (obj_many) {
			if (this.doc[key] === undefined) {
				this.doc[key] = [];
			}
			this.doc[key].push(obj._id);
		} else {
			this.doc[key] = obj._id;
		}

		return this;
	},

	'exists': function () {
		return (this.doc && this.doc._id);
	},

	'getId': function (stringify) {
		return (stringify) ? this.doc._id.toString() : this.doc._id;
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
		var obj_many = false;

		var e, ee;
		var has_one = this.has_one;
		for (e = 0, ee = has_one.length; e < ee; ++e) {
			if (has_one[e][1] == key) {
				embeddable = has_one[e];
				break;
			}
		}
		if (embeddable === null) {
			var has_many = this.has_many;
			for (e = 0, ee = has_many.length; e < ee; ++e) {
				if (has_many[e][1] == key) {
					embeddable = has_many[e];
					obj_many = true;
					break;
				}
			}
		}
		if (embeddable === null) {
			throw 'Object not supported';
		}

		var _getIds = function (key) {
			var keys = key.split('.');
			var val = this.doc;
			for (var e = 0; e < keys.length; ++e) {
				val = val[keys[e]];
			}
			return val;
		}.bind(this);

		var ids = _getIds(key);
		selector._id = (obj_many) ? { $in: ids } : ids;
		selector['date:deleted'] = { $exists: false };
		options['one'] = !obj_many;

		embeddable[0][obj_many ? 'all' : 'one'](selector, options, callback);
	},

	'save': function (callback) {
		for (var key in this) {
			if (this.hasOwnProperty(key) && key.search(':') > -1) {
				this.doc[key] = this[key];
			}
		}

		app.db.collection(this.collection_name, function (err, collection) {
			collection.save(this.doc, function (err) {
				if (err) {
					throw 'Failed to save the document';
				}

				callback();
			}.bind(this));
		}.bind(this));
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

	options['one'] = true;

	this.all(selector, options, callback);
}

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

	var one = !!options['one'];
	if (one) {
		delete options['one'];
	}
	if (options['sort'] === undefined) {
		options['sort'] = 'date:created';
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