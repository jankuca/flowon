var Http = require('http'),
	Url = require('url'),
	Path = require('path'),
	FileSystem = require('fs'),
	Class = require('./modules/class.js').Class;

var Session;

var Router = function () {
	this._ns = '';
	this._routes = [];
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
Router.prototype.match = function (uri) {
	var routes = this._routes,
		route,
		pattern,
		options,
		regexps;

	__route_loop: for (var r = 0, rr = routes.length; r < rr; ++r) {
		route = routes[r];
		pattern = route[1].replace(/\//g, '\\/');
		options = route[2];
		regexps = options.params || {};

		var param_keys = [];
		var p, pp;

		var placeholders = pattern.match(/:[a-z][\w\-]*/g);
		if (placeholders !== null) {
			for (p = 0, pp = placeholders.length; p < pp; ++p) {
				var placeholder = placeholders[p].match(/^:([a-z][\w\-]*)$/);
				param_keys.push(placeholder[1]);
				pattern = pattern.replace(':' + placeholder[1], '([^/]+)');
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
		} else {
			for (p in rules) {
				if (rules.hasOwnProperty(p)) {
					var index = param_keys.indexOf(p);
					if (index == -1 || !rules[p].test(match[index + 1])) {
						continue __route_loop;
					}

					params[p] = match[index + 1];
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


var FlowOn = {
	'_cfg': {
		'port': 8124,
		'db_type': null
	},
	'_controllers': {},
	'__dirname': __dirname + '/',
	'_router': new Router(),

	'ROUTER_PARAM_INTEGER': /^\d+$/
};
FlowOn.set = function (key, value) {
	this._cfg[key] = value;
};
FlowOn.getRouter = function () {
	return this._router;
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
};

FlowOn._startServer = function () {
	this._server = Http.createServer(this._handleRequest.bind(this));
	this._server.listen(this._cfg.port);
	
	console.log('OK... Server is listening on port ' + this._cfg.port + '.');
};

FlowOn._handleRequest = function (request, response) {
	var uri = Url.parse(request.url).pathname;
	console.log('Requesting ' + uri);

	var path;
	var route = this._router.match(uri);
	if (route === null) {
		console.log('No route for ' + uri + '. Trying to access a static file.');

		path = Path.join(this._cfg.public_dir, uri);
		Path.exists(path, function (exists) {
			if (!exists) {
				response.writeHead(404);
				response.end();
				return;
			}

			FileSystem.readFile(path, 'binary', function (error, file) {
				if (error) {
					switch (error.errno) {
					case 21: // EISDIR
						response.writeHead(403);
						response.write('Directory listing is not allowed.');
						break;
					default:
						response.writeHead(500);
						response.write(error.toString());
						break;
					}
					response.end();
					return;
				}

				response.writeHead(200);
				response.write(file, 'binary');
				response.end();
			});
		});

		return;
	}

	path = Path.join(this._cfg.app_dir, 'controllers', route.namespace, route.controller + '.js');
	Path.exists(path, function (exists) {
		if (!exists) {
			response.writeHead(503);
			response.write('Missing controller file: ' + route.controller);
			response.end();
			return;
		}

		var module = require(path);
		if (module.Controller === undefined) {
			response.writeHead(503);
			response.write('The file for the controller ' + route.controller + ' does not match the required output.');
			response.end();
			return;
		}

		var controller = new module.Controller();
		if (controller[route.view] === undefined) {
			response.writeHead(404);
			response.end();
			return;
		}

		// start session
		var cookie_header = request.headers.cookie,
			cookies = {},
			cookie;
		if (cookie_header !== undefined) {
			var header = cookie_header.match(/[^=]+=[^=:;]*/g);
			for (var i = 0, ii = header.length; i < ii; ++i) {
				cookie = header[i].split('=');
				cookies[cookie[0]] = cookie[1];
			}
		}

		var date = new Date();
		var _callView = function (session) {
			date.setDate(date.getDate() + 1);
			controller._headers['Set-Cookie'] = 'FLOWONSESSID=' + session.getId() + '; expires=' + date.toUTCString() + '; path=/';

			controller.request = request;
			controller._method = 'GET';
			controller.response = response;
			controller[route.view](route.params);
		}.bind(this);

		new Session(cookies.FLOWONSESSID, function (session) {
			controller._session = session;

			if (!session.exists()) {
				session['date:created'] = Math.floor(date.getTime() / 1000);
				session.save(_callView.bind(this, session));
			} else {
				_callView(session);
			}
		});
	}.bind(this));
};

exports.FlowOn = FlowOn;
global.app = FlowOn;

Session = require('./modules/models/session.js').Model;