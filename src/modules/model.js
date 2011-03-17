var upper = function (a) {
	return a.toUpperCase();
};

var Model = global.Model = Function.inherit(function (doc) {
	var d = doc || {};
	doc = {};
	Object.getOwnPropertyNames(d).forEach(function (key) {
		Object.defineProperty(doc, key, Object.getOwnPropertyDescriptor(d, key));
	});

	var _stored = !!doc._id,
		_changed = !_stored,
		fieldGetter,
		fieldSetter,
		fields = this.constructor.fields || [];

	Object.defineProperties(this, {
		'stored': {
			get: function () {
				return _stored;
			},
			set: function (value) {
				_stored = !!value;
			},
		},
		'changed': {
			get: function () {
				return _changed;
			},
			set: function (value) {
				_changed = !!value;
			},
		},
		'doc': {
			value: doc,
			writable: false,
		},
		'id': {
			get: function () {
				return doc._id || null;
			},
			set: function (value) {
				if (doc._id !== value) {
					if (doc._id) {
						console.warn('Rewriting an UUID');
					}

					doc._id = value;
					_changed = true;
					_stored = false;
				}
			},
		},
	});

	this._cache = {}; // embedded, parent of embedded
	this._ref = {}; // referenced

	fieldGetter = function (key) {
		if (fields.indexOf(key) === -1) {
			throw new Error('Unknown field: ' + key);
		}
		return this.doc[key];
	};
	fieldSetter = function (key, value) {
		if (fields.indexOf(key) === -1) {
			throw new Error('Unknown field: ' + key);
		}
		this.doc[key] = value;
		_changed = true;
	};
	fields.forEach(function (key) {
		if (key.search(':') === -1) {
			throw new Error('Invalid field name: a namespace required');
		}
		Object.defineProperty(this, key, {
			get: fieldGetter.bind(this, key),
			set: fieldSetter.bind(this, key),
		});
	}, this);

	// id
	if (this.embedded && !_stored) {
		this.doc._id = new app.db.pkFactory();
	}

	// parent
	if (typeof doc._parent === 'object') {
		this._cache.parent = new global[this.constructor.parent_constructor](doc._parent);
		this.parent = this._cache.parent;
	}

	// fields and child models
	Object.getOwnPropertyNames(doc).forEach(function (key) {
		// fields
		if (key.indexOf(':') !== -1 || key[0] === '_') {
			this[key] = doc[key];
			return;
		}
		// child models
		var name = key.replace(/^\w/, upper);
		if (typeof this['get' + name] === 'function') {
			name = name.replace(/ies$/, 'y').replace(/s$/, '');
			var cache,
				M = global[name],
				embedded = (M !== undefined && M.embedded);
			if (key[key.length - 1] === 's') {
				cache = [];
				doc[key].forEach(function (doc) {
					if (embedded) {
						var m = new M(doc);
						m._cache.parent = this;
						cache.push(m);
					} else {
						cache.push(doc);
					}
				}, this);
			} else {
				cache = new M(doc[key]);
				cache._cache.parent = this;
			}
			this[embedded ? '_cache' : '_ref'][key] = cache;
			delete doc[key];
		}
	}, this);
}, {
	'toString': function () {
		return '[object Model]';
	},
	'save': function (options, callback) {
		if (arguments.length === 1) {
			callback = arguments[0];
			options = {};
		}

		var doc = this.doc;
		Object.getOwnPropertyNames(this).forEach(function (key) {
			if (key.indexOf(':') === -1) {
				return;
			}
			if (doc[key] !== this[key]) {
				doc[key] = this[key];
				this.changed = true;
			}
		}, this);

		if (!this.changed) {
			if (typeof callback === 'function') {
				callback(null);
			}
			return;
		}
		if (typeof this.beforeSave === 'function') {
			this.beforeSave();
		}
		if (!this.isValid()) {
			throw new Error('Item is not valid');
		}

		var model = this;

		if (!this.embedded) {
			app.db.collection(model.collection, function (err, collection) {
				if (err) {
					throw err;
				}
				collection.save(model.doc, { 'insert': !model.stored }, function () {
					var cache = model._cache;
					Object.getOwnPropertyNames(cache).forEach(function (key) {
						var models = cache[key];
						if (models instanceof Array === false) {
							models = [models];
						}
						models.some(function (m) {
							if (!m.embedded) {
								return true;
							}
							m.stored = true;
						});
					});

					if (typeof callback === 'function') {
						callback();
					}
				});
			});
		} else {
			// Embedded objects always have their parent in cache and the parent object has all embedded objects cached as well.
			// We are going to get all walk through all those embedded objects until we hit the correct association.
			this.getParent(function (parent) {
				if (!parent.stored) {
					throw new Error('Item is not embedded when it should be.');
				}
				var cache = parent._cache;
				var assoc_key,
					assocs;
				Object.getOwnPropertyNames(cache).some(function (key) {
					var items = cache[key];
					if (items instanceof Array === false) {
						items = items ? [items] : [];
					}
					if (items[0] !== undefined && model instanceof items[0].constructor) {
						assoc_key = key;
						assocs = cache[key];
						return true;
					}
				});
				if (assocs instanceof Array) {
					if (assocs.id.toString() === model.id.toString()) {
						
					}
				}
			});
		}
	},

	'remove': function (options, callback) {
		if (arguments.length === 1) {
			callback = arguments[0];
			options = {};
		}

		var id = this.id;
		if (id === null) {
			throw new Error('Error: Object has no ID');
		}
		if (typeof this.beforeDelete === 'function') {
			this.beforeDelete();
		}

		app.db.collection(this.collection, function (err, collection) {
			collection.remove({ _id: id }, callback);
		});
	},

	'isValid': function () {
		var errors = {},
			errors_json,
			rules;

		rules = this.constructor.prototype.validates_presence_of || [];
		rules.forEach(function (key) {
			if (!this[key]) {
				if (errors[key] === undefined) {
					errors[key] = [];
				}
				errors[key].push('presence');
			}
		}, this);

		rules = this.constructor.prototype.validates_format_of || {};
		Object.getOwnPropertyNames(rules).forEach(function () {
			if (!rules[key].test(this[key])) {
				if (errors[key] === undefined) {
					errors[key] = [];
				}
				errors[key].push('format');
			}
		}, this);

		errors_json = JSON.stringify(errors);
		this.errors = (errors_json !== '{}') ? errors : null;
		return !this.errors;
	},

	'updateTimestamp': function (key) {
		var desc = Object.getOwnPropertyDescriptor(this, key);
		if (desc === undefined) {
			throw new Error('Unknown field (' + key + ')');
		}
		this[key] = Math.round(new Date().getTime() / 1000);
	},

	'ref': function (m, key) {
		if (m instanceof Model === false) {
			throw new Error('ref: Only models can be referenced.');
		}
		if (m.id === null) {
			throw new Error('embed: Only saved models can be referenced.');
		}

		key = key || this._getKey(m);
		this._cacheItem(key, m.id, true);
		this.doc[key] = this._ref[key];
		this.changed = true;
	},

	'embed': function (m) {
		if (m instanceof Model === false) {
			throw new Error('embed: Only models can be embedded.');
		}

		var key = this._getKey(m);
		this._cacheItem(key, m);
		this.doc[key] = this._cache[key];
		this.changed = true;
	},

	'_getKey': function (m) {
		var model;
		Model.getChildFunctions().some(function (fn) {
			if (m instanceof fn) {
				model = fn;
				return true;
			}
		});
		var key = model.key;
		if (typeof this['get' + key.replace(/^\w/, upper)] !== 'function') {
			key = key.replace(/y$/, 'ies').replace(/[^s]$/, function (a) {
				return a + 's';
			});
		}
		return key;
	},
	'_cacheItem': function (key, item, ref) {
		var many = (key[key.length - 1] === 's'),
			cache = this[ref ? '_ref' : '_cache'];
		if (many) {
			if (cache[key] === undefined) {
				cache[key] = [];
			}
			cache[key].push(item);
		} else {
			cache[key] = item;
		}
	},
});

Object.defineProperties(Model.prototype, {
	'collection': {
		get: function () {
			if (this.embedded) {
				throw new Error('Embedded models do not have a collection defined.');
			}
			return this.constructor.collection;
		},
	},
	'embedded': {
		get: function () {
			return !!this.constructor.embedded;
		},
	},
});

var originalInherit = Model.inherit;
Model.inherit = function (key, init, proto) {
	if (typeof arguments[0] !== 'string' && arguments[0] !== undefined) {
		proto = arguments[1];
		init = arguments[0];
		key = undefined;
	}

	var M = originalInherit.call(this, init, proto);
	if (key !== undefined) {
		M.key = key;
		M.collection = key.replace(/y$/, 'ies').replace(/[^s]$/, function (a) {
			return a + 's';
		});
	}
	return M;
};

Model.one = function (selector, options, callback) {
	if (arguments.length === 1) {
		callback = arguments[0];
		options = {};
		selector = {};
	} else if (arguments.length === 2) {
		callback = arguments[1];
		options = {};
	}
	selector = selector || {};
	options = options || {};

	options.limit = 1;
	this.all(selector, options, callback);
};
Model.all = function (selector, options, callback) {
	if (arguments.length === 1) {
		callback = arguments[0];
		options = {};
		selector = {};
	} else if (arguments.length === 2) {
		callback = arguments[1];
		options = {};
	}
	selector = selector || {};
	options = options || {};
	if (typeof callback !== 'function') {
		throw new Error('Missing callback');
	}

	var M = this;

	if (typeof selector !== 'object') {
		selector = { _id: selector };
	}
	if (selector._id !== undefined && typeof selector._id === 'string') {
		selector._id = app.db.pkFactory(selector._id);
	}

	if (options.sort === undefined) {
		options.sort = 'date:created';
	}

	app.db.collection(this.collection, function (err, collection) {
		collection[options.limit === 1 ? 'findOne' : 'find'](selector || {}, options, function (err, docs) {
			if (options.limit !== 1) {
				docs.toArray(function (err, docs) {
					var res = [];
					for (var d = 0, dd = docs.length; d < dd; ++d) {
						res.push(new M(docs[d]));
					}

					callback(res);
				});
			} else {
				callback(new M(docs));
			}
		});
	});
};

Model.has_one = function (has_one) {
	if (has_one instanceof Array !== true) {
		has_one = Array.prototype.slice.call(arguments);
	}

	has_many.forEach(function (key) {
		var name = key.replace(/^\w/, upper);
		this.prototype['get' + name] = function (callback) {
			var M = global[name.replace(/ies$/, 'y').replace(/s$/, '')],
				id = this._ref[key] || null;
			M.one({ '_id': id }, callback);
		};
	}, this);
};
Model.has_many = function (has_many) {
	if (has_many instanceof Array !== true) {
		has_many = Array.prototype.slice.call(arguments);
	}

	has_many.forEach(function (key) {
		var name = key.replace(/^\w/, upper);
		this.prototype['get' + name] = function (selector, options, callback) {
			if (arguments.length === 1) {
				callback = arguments[0];
				options = {};
				selector = {};
			} else if (arguments.length === 2) {
				callback = arguments[1];
				options = arguments[0];
				selector = {};
			}

			var M = global[name.replace(/ies$/, 'y').replace(/s$/, '')],
				ids = this._ref[key] || [];
			if (ids.length === 0) {
				return callback([]);
			}
			selector._id = { $in: ids };
			M.all(selector, options, callback);
		};
	}, this);
};
Model.belongs_to = function (key) {
	if (key instanceof Array === true || arguments.length > 1) {
		throw new Error('belongs_to: Multiple parents are not implemented');
	}

	var name = key.replace(/^\w/, upper);
	this.prototype.getParent = function (callback) {
		var selector = {};
		selector[this.constructor.collection] = this.id;
		global[name].one(selector, callback);
	};
};

Model.embeds_one = function (embeds_one) {
	if (embeds_one instanceof Array !== true) {
		embeds_one = Array.prototype.slice.call(arguments);
	}

	embeds_one.forEach(function (key) {
		var name = key.replace(/^\w/, upper);
		this.prototype['get' + name] = function (callback) {
			var model = this._cache[key] || null;
			if (typeof callback === 'function') {
				callback(model)
			} else {
				return model;
			}
		};
	}, this);
};
Model.embeds_many = function (embeds_many) {
	if (embeds_many instanceof Array !== true) {
		embeds_many = Array.prototype.slice.call(arguments);
	}

	embeds_many.forEach(function (key) {
		var name = key.replace(/^\w/, upper);
		this.prototype['get' + name] = function (callback) {
			var models = this._cache[key] || [];
			if (typeof callback === 'function') {
				callback(models)
			} else {
				return models;
			}
		};
	}, this);
};
Model.embedded_in = function (embedded_in) {
	if (embedded_in instanceof Array === true || arguments.length > 1) {
		throw new Error('belongs_to: Multiple parents are not implemented');
	}

	this.embedded = true;
	this.prototype.getParent = function (callback) {
		var parent = this._cache.parent;
		if (parent === undefined) {
			throw new Error('Object not embedded');
		}
		if (typeof callback === 'function') {
			callback(parent);
		} else {
			return parent;
		}
	};
};