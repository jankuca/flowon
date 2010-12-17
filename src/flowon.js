var Http = require('http'),
	Url = require('url'),
	Path = require('path'),
	FileSystem = require('fs');


Function.prototype.bind = function (context) {
	if (arguments[0] === undefined) {
		return this;
	}
	var fn = this;
	return function () {
		return fn.apply(context, arguments);
	}
};


var FlowOn_Router = function () {
	this._routes = [];
};
FlowOn_Router.prototype.namespace = function (ns) {
	if (ns === null) {
		this._ns = '';
	} else {
		this._ns = '/' + ns;
	}
}
FlowOn_Router.prototype.push = function (pattern, options) {
	this._routes.push([
		this._ns + pattern,
		options
	]);
};
FlowOn_Router.prototype.match = function (uri) {
	var routes = this._routes,
		route,
		pattern,
		options;

	__route_loop: for (var r = 0, rr = routes.length; r < rr; ++r) {
		route = routes[r];
		pattern = route[0].replace(/\//g, '\\/');
		options = route[1],
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
	'_router': new FlowOn_Router(),

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

		var path = Path.join(process.cwd(), 'public', uri);
		Path.exists(path, function(exists) {
			if(!exists) {
				response.writeHead(404);
				response.end();
				return;
			}

			FileSystem.readFile(path, 'binary', function(error, file) {
				if(error) {
					response.writeHead(500);
					response.write(err);
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

	if (this._controllers[route.controller] === undefined) {
		var module = require(this._cfg.app_dir + 'controllers/' + route.controller + '.js');
		if(module.Controller === undefined) {
			response.writeHead(503);
			response.write('The file for the controller ' + route.controller + ' does not match the required output.');
			response.end();
			return;
		}

		this._controllers[route.controller] = module.Controller;
	}

	var controller = new this._controllers[route.controller]();
	if (controller[route.view] === undefined) {
		response.writeHead(404);
		response.end();
		return;
	}

	controller.request = request;
	controller._method = 'GET';
	controller.response = response;
	controller[route.view](route.params);
};

FlowOn.createController = function(key, parent_key) {
	return function () {}
};

this.FlowOn = FlowOn;
