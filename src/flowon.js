var Http = require('http'),
	Url = require('url'),
	Path = require('path'),
	FileSystem = require('fs'),
	Class = require('./modules/class.js').Class,
	Model = require('./modules/model.js').Model;


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
}
Router.prototype.push = function (pattern, options) {
	this._routes.push([
		this._ns == '' ? null : this._ns.substr(1),
		this._ns + pattern,
		options
	]);
};
Router.prototype.match = function (uri) {
	var routes = this._routes,
		route,
		pattern,
		options;

	__route_loop: for (var r = 0, rr = routes.length; r < rr; ++r) {
		route = routes[r];
		pattern = route[1].replace(/\//g, '\\/');
		options = route[2],
		regexps = options.params || {};

		var param_keys = [];

		var placeholders = pattern.match(/:[a-z][\w-]*/g);
		if (placeholders !== null) {
			for (var p = 0, pp = placeholders.length; p < pp; ++p) {
				var placeholder = placeholders[p].match(/^:([a-z][\w-]*)$/);
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
			for (var p = 0, pp = param_keys.length; p < pp; ++p) {
				if (!rules.test(match[p + 1])) {
					continue __route_loop;
				}

				params[param_keys[p]] = match[p + 1];
			}
		} else {
			for (var p in rules) {
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
	switch(this._cfg.db_type) {
	case 'mongodb':
		this.db = new this.db_driver.Db(
			this._cfg.db_name,
			new this.db_driver.Server(
				this._cfg.db_server,
				this._cfg.db_port,
				{}
			)
		);
		this.db.open(function(error) {
			if(error) {
				console.log('Connection to the database failed: ' + error);
				return;
			}
			FlowOn._startServer();
		});
		break;
	}
};

FlowOn._startServer = function() {
	this._server = Http.createServer(this._handleRequest.bind(this));
	this._server.listen(this._cfg.port);
	
	console.log('OK... Server is listening on port ' + this._cfg.port + '.');
};

FlowOn._handleRequest = function (request, response) {
	var uri = Url.parse(request.url).pathname;
	console.log('Requesting ' + uri);

	var route = this._router.match(uri);
	if (route === null) {
		console.log('No route for ' + uri + '. Trying to access a static file.');

		var path = Path.join(this._cfg.public_dir, uri);
		Path.exists(path, function(exists) {
			if(!exists) {
				response.writeHead(404);
				response.end();
				return;
			}

			FileSystem.readFile(path, 'binary', function(error, file) {
				if(error) {
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

	var path = Path.join(this._cfg.app_dir, 'controllers', route.namespace, route.controller + '.js');
	Path.exists(path, function (exists) {
		if(!exists) {
			response.writeHead(503);
			response.write('Missing controller file: ' + route.controller);
			response.end();
			return;
		}

		var module = require(path);
		if(module.Controller === undefined) {
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

		controller.request = request;
		controller._method = 'GET';
		controller.response = response;
		controller[route.view](route.params);
	}.bind(this));
};

FlowOn.createController = function(key, parent_key) {
	return function () {}
};

this.FlowOn = FlowOn;
