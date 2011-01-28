var Http = require('http'),
	Url = require('url'),
	Path = require('path'),
	FileSystem = require('fs'),
	EJS = require('../lib/ejs/ejs.js').EJS,
	Class = require('./modules/class.js').Class;

var Session,
	Controller,
	Template,
	HttpRequest,
	HttpResponse;

var Emitter = Class.create({
	'on': function (type, listener) {
		if (this._listeners === undefined) {
			this._listeners = {};
		}
		if (this._listeners[type] === undefined) {
			this._listeners[type] = [];
		}
		this._listeners[type].push(listener);
	},
	'emit': function (type) {
		var args = Array.prototype.slice.call(arguments, 1);
		if (this._listeners === undefined) {
			return;
		}
		var listeners = this._listeners[type];
		if (listeners === undefined) {
			return;
		}
		var i, ii, result;
		for (i = 0, ii = listeners.length; i < ii; ++i) {
			result = listeners[i].apply(this, args);
			if (result === false) {
				return;
			}
		}
	}
});

var Router = function () {
	this._ns = '';
	this._routes = [];
	this._staticNS = [];

	this.PARAM_HEX = /^[a-f0-9]+$/i;
	this.PARAM_INTEGER = /^\d+$/;
};
Router.prototype.namespace = function (ns) {
	if (ns === null) {
		this._ns = '';
	} else {
		this._ns = '/' + ns;
	}
};
Router.prototype.push = function (pattern, options) {
	this._routes.push([
		this._ns === '' ? null : this._ns.substr(1),
		this._ns + pattern,
		options
	]);
};
Router.prototype.pushStaticNamespace = function (ns) {
	this._staticNS.push(ns);
};
Router.prototype.match = function (uri, qs) {
	var staticNS = this._staticNS;
	for (var s = 0, ss = staticNS.length; s < ss; ++s) {
		var ns = staticNS[s];
		if (uri == '/' + ns || (new RegExp('^/' + ns + '/')).test(uri)) {
			return null;
		}
	}

	var routes = this._routes,
		route,
		pattern,
		options, _options,
		regexps;
	
	if (!!qs) {
		var query = Url.parse('/qs?' + qs, true).query;
	}

	__route_loop: for (var r = 0, rr = routes.length; r < rr; ++r) {
		route = routes[r];
		pattern = route[1].replace(/\//g, '\\/');
		_options = route[2];
		options = {};
		for (var o in _options) {
			if (_options.hasOwnProperty(o)) {
				options[o] = _options[o];
			}
		}

		var param_keys = [];
		var p, pp;

		var placeholders = pattern.match(/:_?[a-z][\w\-]*/g);
		if (placeholders !== null) {
			for (p = 0, pp = placeholders.length; p < pp; ++p) {
				var placeholder = placeholders[p].match(/^:(_?[a-z][\w\-]*)$/);
				param_keys.push(placeholder[1]);
				pattern = pattern.replace(':' + placeholder[1], ['_c', '_v'].indexOf(placeholder[1]) === -1 ? '([^/]+)' : '([^/\.]+)');
			}
		}

		var match = new RegExp('^' + pattern + '\\/?$').exec(uri);
		if (match === null) {
			continue;
		}

		var rules = options.params,
			params = {};
		if (rules instanceof RegExp) {
			for (p = 0, pp = param_keys.length; p < pp; ++p) {
				if (!rules.test(match[p + 1])) {
					continue __route_loop;
				}

				params[param_keys[p]] = match[p + 1];
			}
		} else if (rules === undefined) {
			for (p = 0, pp = param_keys.length; p < pp; ++p) {
				params[param_keys[p]] = match[p + 1];
			}
		} else {
			for (p in rules) {
				if (rules.hasOwnProperty(p)) {
					var index = param_keys.indexOf(p);
					if (index > -1) {
						if (!rules[p].test(match[index + 1])) {
							continue __route_loop;
						}

						params[p] = match[index + 1];
					}
				}
			}
		}

		if (options.controller[0] == ':') {
			var key = options.controller.substr(1);
			options.controller = params[key];
			if (options.controller === undefined) {
				throw 'Invalid route: Undefined parameter :' + key;
			}
		}

		if (options.view[0] == ':') {
			var key = options.view.substr(1);
			options.view = params[key];
			if (options.view === undefined) {
				throw 'Invalid route: Undefined parameter :' + key;
			}
		}

		// query string
		if (!!qs) {
			var q;
			if (rules instanceof RegExp) {
				for (q in query) {
					if (query.hasOwnProperty(q)) {
						if (!rules.test(query[q])) {
							continue __route_loop;
						}

						params[q] = query[q];
					}
				}
			} else if (rules === undefined) {
				for (q in query) {
					if (query.hasOwnProperty(q)) {
						params[q] = query[q];
					}
				}
			} else {
				for (q in query) {
					if (query.hasOwnProperty(q)) {
						if (!rules.hasOwnProperty(q) || !rules[q].test(query[q])) {
							continue __route_loop;
						}

						params[q] = query[q];
					}
				}
			}
		}

		return {
			'namespace': route[0],
			'controller': options.controller,
			'view': options.view,
			'params': params
		};
	}

	return null;
};

Router.prototype.resolve = function (target, abs) {
	if (abs && !app._cfg.domain) {
		throw 'Invalid state: No domain set';
	}

	var routes = this._routes,
		route,
		uri,
		options,
		regexps,
		params = target.params || {},
		param_keys;
	
	var create_qs = function (params, param_keys) {
		var query = [];
		for (var p in params) {
			if (params.hasOwnProperty(p) && ['_c', '_v'].indexOf(p) == -1 && param_keys.indexOf(p) == -1) {
				query.push(p + '=' + encodeURIComponent(params[p]));
			}
		}
		return (query.length > 0) ? '?' + query.join('&') : '';
	};

	__route_loop: for (var r = 0, rr = routes.length; r < rr; ++r) {
		route = routes[r];
		uri = route[1];
		options = route[2];

		// if the namespace does not match, move to the next route
		if (route[0] != target.namespace) {
			continue;
		}

		var p, pp;
		param_keys = [];
		params['_c'] = target.controller;
		params['_v'] = target.view;

		// check whether there are values for all placeholders in the route pattern
		var placeholders = uri.match(/:_?[a-z][\w\-]*/g);
		if (placeholders !== null) {
			for (p = 0, pp = placeholders.length; p < pp; ++p) {
				var placeholder = placeholders[p].match(/^:(_?[a-z][\w\-]*)$/);
				param_keys.push(placeholder[1]);
				if (params[placeholder[1]] === undefined) {
					continue __route_loop;
				}
			}
		}

		var r_controller = options.controller;
		if (r_controller[0] == ':') {
			var key = r_controller.substr(1);
			if (params[key] === undefined) {
				continue;
			}
			r_controller = params[key];
		}
		if (r_controller != target.controller) {
			continue;
		}

		var r_view = options.view;
		if (r_view[0] == ':') {
			var key = r_view.substr(1);
			if (params[key] === undefined) {
				continue;
			}
			r_view = params[key];
		}
		if (r_view != target.view) {
			continue;
		}

		var rules = options.params,
			key;
		if (rules === undefined) {
			for (p = 0, pp = param_keys.length; p < pp; ++p) {
				key = param_keys[p];
				uri = uri.replace(':' + key, params[key]);
			}
		} else if (rules instanceof RegExp) {
			for (p = 0, pp = param_keys.length; p < pp; ++p) {
				key = param_keys[p];
				if (!rules.test(params[key])) {
					continue __route_loop;
				}
				uri = uri.replace(':' + key, params[key]);
			}
		} else {
			for (p = 0, pp = param_keys.length; p < pp; ++p) {
				key = param_keys[p];
				if (rules[key] !== undefined && !rules[key].test(params[key])) {
					continue __route_loop;
				}
				uri = uri.replace(':' + key, params[key]);
			}
		}
		return (abs ? 'http://' + app._cfg.domain + (app._cfg.port !== 80 && app._cfg.proxy_port !== 80 ? ':' + (app._cfg.proxy_port || app._cfg.port) : '') : '') + uri + create_qs(params, param_keys);
	}

	return null;
};


var FlowOn = {
	'_cfg': {
		'base_uri': '/',
		'port': 8124,
		'db_type': null,
		'max_execution_time': 15,
		'session_expiration': '+ 1 day'
	},
	'_controllers': {},
	'__dirname': __dirname + '/',
	'_router': new Router()
};
FlowOn.set = function (key, value) {
	this._cfg[key] = value;
};
FlowOn.setDbDriver = function (driver) {
	if (driver) {
		this.db_driver = driver;
	}
};
FlowOn.setMemcached = function (client) {
	if (client) {
		this.memcached_client = client;
	}
};
FlowOn.getMemcached = function () {
	return this.memcached_client;
};
FlowOn.getRouter = function () {
	return this._router;
};
FlowOn.getHeadersByExtension = function (ext) {
	var headers = {};

	switch (ext) {
	case '.html':
		headers['content-type'] = 'text/html; charset=UTF-8';
		break;
	case '.js':
		headers['content-type'] = 'text/javascript; charset=UTF-8';
		break;
	case '.css':
		headers['content-type'] = 'text/css; charset=UTF-8';
		break;
	case '.manifest':
		headers['content-type'] = 'text/cache-manifest; charset=UTF-8';
		break;
	default:
		var date = new Date();
		date.setFullYear(date.getFullYear() + 1);
		headers['expires'] = date.toUTCString();
	}

	return headers;
};
FlowOn.getStaticVariables = function (request, response) {
	return {
		'base_uri': this._cfg.base_uri,
		'browser': request.browser,
		'_request': request,
		'_response': response
	};
};
FlowOn.run = function () {
	console.log('Starting the server...');

	if (this._cfg.db_type === null) {
		console.log('Starting without a database');
	} else if (this.db_driver === undefined) {
		console.log('Database driver not loaded.');
		return;
	}

	console.log('Using the "' + this._cfg.db_type + '" database driver.');
	switch (this._cfg.db_type) {
	case 'mongodb':
		this.db = new this.db_driver.Db(
			this._cfg.db_name,
			new this.db_driver.Server(
				this._cfg.db_server,
				this._cfg.db_port,
				{}
			)
		);
		this.db.open(function (error) {
			if (error) {
				console.log('Connection to the database failed: ' + error);
				return;
			}

			FlowOn._startServer();
		});
		break;
	}

	Template.loadHelpers(Path.join(this.__dirname, 'helpers'));
	Template.loadHelpers(Path.join(this._cfg.app_dir, 'helpers'));
};

FlowOn._startServer = function () {
	this._server = Http.createServer(this._handleRequest.bind(this));
	this._server.listen(this._cfg.port);
	
	console.log('OK... Server is listening on ' + (this._cfg.domain || '*') + ':' + this._cfg.port + '.');
};

FlowOn._handleRequest = function (request, response) {
	if (this._cfg.domain && request.headers.host.split(':')[0] != this._cfg.domain) {
		response.writeHead(404);
		response.end();
		return;
	}

	var uri = Url.parse(request.url).pathname;
	console.log(request.method + ' ' + uri);

	request = new HttpRequest(request);
	response = new HttpResponse(response);

	try {
		var route = this._router.match(uri, request.url.split('?', 2)[1]);
	} catch (exc) {
		var controller = new Controller();
		controller._request = request;
		controller._method = request.method;
		controller._response = response;
		controller.terminate(503, exc);
		return;
	}
	if (route === null) {
		console.log('    ' + uri + ' --> static');

		var path = Path.join(this._cfg.public_dir, uri);
		Path.exists(path, function (exists) {
			if (!exists) {
				response.status = 404;
				response.end();
				return;
			}

			FileSystem.readFile(path, 'binary', function (error, file) {
				if (error) {
					switch (error.errno) {
					case 21: // EISDIR
						if (uri[uri.length - 1] != '/') {
							response.status = 301;
							response.setHeader('location', uri + '/');
							response.end();
							return;
						}

						path = Path.join(path, 'index.html');
						Path.exists(path, function (exists) {
							if (!exists) {
								var controller = new Controller();
								controller._request = request;
								controller._method = request.method;
								controller._response = response;
								controller.terminate(403, 'Directory listing is not allowed.');
								return;
							}

							FileSystem.readFile(path, 'UTF-8', function (error, file) {
								if (error) {
									var controller = new Controller();
									controller._request = request;
									controller._method = request.method;
									controller._response = response;
									controller.terminate(500, error.toString(error.toString()));
									return;
								}
								
								var ejs = new EJS({
									'text': file
								});

								response.setHeaders(this.getHeadersByExtension('.html'));
								response.write(ejs.render(this.getStaticVariables(request, response)));
								response.end();
							}.bind(this));
						}.bind(this));
						return;
					default:
						var controller = new Controller();
						controller._request = request;
						controller._method = request.method;
						controller._response = response;
						controller.terminate(500, error.toString(error.toString()));
						break;
					}
					response.end();
					return;
				}

				var ejs_extensions = ['.html', '.css'],
					ext = Path.extname(path);
				response.setHeaders(this.getHeadersByExtension(ext));
				if (ejs_extensions.indexOf(ext) > -1) {
					var ejs = new EJS({
						'text': file
					});
					response.write(ejs.render(this.getStaticVariables(request, response)), 'UTF-8');
				} else {
					response.write(file, 'binary');
				}
				response.end();
			}.bind(this));
		}.bind(this));

		return;
	}

	path = Path.join(this._cfg.app_dir, 'controllers', route.namespace, route.controller + '.js');
	Path.exists(path, function (exists) {
		if (!exists) {
			var controller = new Controller();
			controller._request = request;
			controller._method = request.method;
			controller._response = response;
			controller.terminate(404, 'Missing controller file: ' + route.controller);
			return;
		}

		var module = require(path);
		if (module.Controller === undefined) {
			var controller = new Controller();
			controller._request = request;
			controller._method = request.method;
			controller._response = response;
			controller.terminate(404, 'The file for the controller \'' + route.controller + '\' does not match the required output.');
			return;
		}

		var _startController = function () {
			var controller = new module.Controller();
			controller._request = request;
			controller._method = request.method;
			controller._data = request.data;
			controller._response = response;
			controller._namespace = route.namespace;
			controller._name = route.controller;
			controller._view = route.view;

			var fn = function (session) {
				controller._session = session;
				response.setCookie('FLOWONSESSID', session.getId(), this._cfg.session_expiration, undefined, '.' + request.host.replace(/:[\d]+$/, ''), false, true);

				var execution_timeout = setTimeout(
					function () {
						controller.terminate(503, 'Reached the maximum execution time of ' + this._cfg.max_execution_time + 's.');
					}.bind(this),
					this._cfg.max_execution_time * 1000
				);

				var _callView = function () {
					if (controller[route.view] !== undefined) {
						var mode = controller[route.view](route.params);
						if (mode !== undefined) {
							switch (mode) {
							case controller.NO_EXECUTION_LIMIT:
								clearTimeout(execution_timeout);
							}
						}
					} else {
						controller.render(200);
					}
				};
				controller._callView = _callView;

				try {
					var startup_mode = controller.startup(route.params);
				} catch (exc) {			
					var c = new Controller();
					c._request = request;
					c._method = request.method;
					c._response = response;
					c.terminate(503, exc);
					return;
				}

				if (controller[route.view] === undefined) {
					if (startup_mode !== false) {
						controller.render(200);
					}
					return;
				}

				if (startup_mode === false) {
					return;
				}

				_callView();
			}.bind(this);

			var createSession = function () {
				var session = new Session();
				session['date:created'] = Math.floor(new Date().getTime() / 1000);
				session.save(fn.bind(this, session));
			}.bind(this);

			if (request.cookies.FLOWONSESSID) {
				Session.one(request.cookies.FLOWONSESSID, function (session) {
					if (!session.exists()) {
						createSession();
					} else {
						fn.call(this, session);
					}
				});
			} else {
				createSession();
			}
		}.bind(this);

		request.callback = _startController;
	}.bind(this));
};

FlowOn.Emitter = Emitter;

exports.FlowOn = FlowOn;
global.app = FlowOn;

global.Class = Class;

Session = require('./modules/models/session.js').Model;
HttpRequest = require('./modules/httprequest.js').HttpRequest;
HttpResponse = require('./modules/httpresponse.js').HttpResponse;
Controller = require('./modules/controller.js').Controller;
Template = require('./modules/template.js').Template;