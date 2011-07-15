var Router = module.exports.Router = Function.inherit(function () {
	var _namespace = '';
	Object.defineProperty(this, 'namespace', {
		'get': function () {
			return _namespace;
		},
		'set': function (ns) {
			_namespace = (ns === null) ? '' : '/' + ns;
		},
	});

	Object.defineProperties(this, {
		'PARAM_HEX': { 'value': /^[a-f0-9]+$/i, 'writable': false },
		'PARAM_INTEGER': { 'value': /^\d+$/, 'writable': false },
	});

	this._routes = [];
	this._staticDomains = [];
	this._staticNS = [];
}, {
	'push': function (pattern, options) {
		var is_valid = (options.controller && options.view);
		if (options.params && options.params instanceof RegExp === false) {
			is_valid = (is_valid && Object.keys(options.params).every(function (key) {
				return (options.params[key] instanceof RegExp);
			}));
		}
		if (!is_valid) {
			throw new Error('Invalid route: ' + pattern);
		}

		var ns = this.namespace;
		this._routes.push([
			ns === '' ? null : ns.substr(1),
			ns + pattern,
			options
		]);
	},

	'bindStaticDomain': function (pattern, path) {
		this._staticDomains.push([pattern, path]);
	},

	'pushStaticNamespace': function (ns) {
		this._staticNS.push(ns);
	},
	'match': function (url) {
		var routes = this._routes,
			pathname = url.pathname,
			query = url.query,
			result = null;

		if (this._staticDomains.some(function (rule) {
			if ((rule[0] instanceof RegExp && rule[0].test(url.hostname)) || url.hostname === String(rule[0])) {
				result = {
					'static': true,
					'dir': rule[1],
				};
				return true;
			}
		})) {
			return result;
		}

		if (this._staticNS.some(function (ns) {
			if (pathname === '/' + ns || (new RegExp('^/' + ns + '/')).test(pathname)) {
				return true;
			}
		})) {
			return result;
		}

		routes.some(function (route) {
			var pattern = route[1].replace(/\/$/, '').replace(/\//g, '\\/'),
				placeholders = pattern.match(/:_?[a-z][\w\-]*/g),
				match,
				options = {},
				params = {},
				param_keys = [],
				rules,
				key;

			
			Object.getOwnPropertyNames(route[2]).forEach(function (key) {
				options[key] = route[2][key];
			});
			rules = options.params;

			if (placeholders !== null) {
				placeholders.forEach(function (placeholder) {
					placeholder = placeholder.match(/^:(_?[a-z][\w\-]*)$/);
					param_keys.push(placeholder[1]);
					pattern = pattern.replace(':' + placeholder[1], '([^/]+)');
				});
			}

			match = new RegExp('^' + pattern + '\\/?$').exec(pathname);
			if (match === null) {
				return;
			}

			if (rules instanceof RegExp) {
				if (param_keys.some(function (key, i) {
					if (!rules.test(match[i + 1])) {
						return true;
					}
					params[key] = match[i + 1];
				})) {
					return;
				}
			} else if (rules === undefined) {
				param_keys.forEach(function (key, i) {
					params[key] = match[i + 1];
				});
			} else {
				if (Object.getOwnPropertyNames(rules).some(function (key) {
					var index = param_keys.indexOf(key);
					if (index > -1) {
						if (!rules[key].test(match[index + 1])) {
							return true;
						}
						params[key] = match[index + 1];
					}
				})) {
					return;
				}
			}

			if (options.controller[0] === ':') {
				key = options.controller.substr(1);
				options.controller = params[key];
				if (options.controller === undefined) {
					throw new Error('Invalid route: Undefined parameter :' + key);
				}
			}

			if (options.view[0] === ':') {
				key = options.view.substr(1);
				options.view = params[key];
				if (options.view === undefined) {
					throw new Error('Invalid route: Undefined parameter :' + key);
				}
			}

			// query string
			if (Boolean(url.search)) {
				if (rules instanceof RegExp) {
					if (Object.getOwnPropertyNames(query).some(function (key) {
						if (!rules.test(query[key])) {
							return true;
						}
						params[key] = query[key];
					})) {
						return;
					}
				} else if (rules === undefined) {
					Object.getOwnPropertyNames(query).forEach(function (key) {
						params[key] = query[key];
					});
				} else {
					if (Object.getOwnPropertyNames(query).some(function (key) {
						if (rules.hasOwnProperty(key) && !rules[key].test(query[key])) {
							return true;
						}
						params[key] = query[key];
					})) {
						return;
					}
				}
			}

			result = {
				'static': false,
				'namespace': route[0],
				'controller': options.controller,
				'view': options.view,
				'params': params
			};
			return true;
		});

		return result;
	},
	'resolve': function (target) {
		var routes = this._routes,
			result = null;
		
		var create_qs = function (params, param_keys) {
			var query = [];
			Object.getOwnPropertyNames(params).forEach(function (key) {
				if (['_c', '_v'].indexOf(key) === -1 && param_keys.indexOf(key) === -1) {
					query.push(key + '=' + encodeURIComponent(params[key]));
				}
			});
			return (query.length > 0) ? '?' + query.join('&') : '';
		};

		routes.some(function (route) {
			var uri = route[1],
				placeholders = uri.match(/:_?[a-z][\w\-]*/g),
				options = route[2],
				r_controller = options.controller,
				r_view = options.view,
				rules = options.params,
				param_keys = [],
				params = target.params || {},
				key;

			// if the namespace does not match, move to the next route
			if (route[0] !== target.namespace) {
				return;
			}

			params._c = target.controller;
			params._v = target.view;

			// check whether there are values for all placeholders in the route pattern
			if (placeholders !== null) {
				if (placeholders.some(function (placeholder) {
					placeholder = placeholder.match(/^:(_?[a-z][\w\-]*)$/);
					param_keys.push(placeholder[1]);
					if (params[placeholder[1]] === undefined) {
						return true;
					}
				})) {
					return;
				}
			}

			if (r_controller[0] === ':') {
				key = r_controller.substr(1);
				if (params[key] === undefined) {
					return;
				}
				r_controller = params[key];
			}
			if (r_view[0] === ':') {
				key = r_view.substr(1);
				if (params[key] === undefined) {
					return;
				}
				r_view = params[key];
			}
			if (r_controller !== target.controller || r_view !== target.view) {
				return;
			}

			if (rules === undefined) {
				param_keys.forEach(function (key) {
					uri = uri.replace(':' + key, params[key]);
				});
			} else if (rules instanceof RegExp) {
				if (param_keys.some(function (key) {
					if (!rules.test(params[key])) {
						return true;
					}
					uri = uri.replace(':' + key, params[key]);
				})) {
					return;
				}
			} else {
				if (param_keys.some(function (key) {
					if (rules[key] !== undefined && !rules[key].test(params[key])) {
						return true;
					}
					uri = uri.replace(':' + key, params[key]);
				})) {
					return;
				}
			}

			result = uri + create_qs(params, param_keys);
			return true;
		});

		return result;
	},
});