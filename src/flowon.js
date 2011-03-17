/*global setTimeout, clearTimeout*/

require.paths.unshift(__dirname + '/../lib/');

require('../lib/utils/utils.js');
require('./modules/router.js');

var Http = require('http'),
	Url = require('url'),
	Path = require('path'),
	FileSystem = require('fs'),
	EJS = require('../lib/ejs/ejs.js').EJS;

var app = {
	'set': function (key, value) {
		this._cfg[key] = value;
	},
	'setDbDriver': function (driver) {
		if (driver) {
			this.db_driver = driver;
		}
	},
	'getHeadersByExtension': function (ext) {
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
			headers.expires = date.toUTCString();
		}

		return headers;
	},
	'getStaticVariables': function (request, response) {
		return {
			'base_uri': this._cfg.base_uri,
			'browser': request.browser,
			'_request': request,
			'_response': response
		};
	},
	'run': function (callback) {
		global.SOURCE_DIR = __dirname + '/';
		global.APP_DIR = this._cfg.app_dir;
		global.PUBLIC_DIR = this._cfg.public_dir;

		require('./modules/httprequest.js');
		require('./modules/httpresponse.js');
		require('./modules/cache.js');
		require('./modules/template.js');
		require('./modules/model.js');
		require('./modules/controller.js');
		require('./modules/apicontroller.js');

		this._loadModels();

		console.log('Starting the server...');

		var app = this;

		this._startDb(function () {
			app._startServer();

			if (typeof callback === 'function') {
				callback();
			}
		});

		if (this.db !== undefined) {
			require('./modules/models/session.js');
		} else {
			console.log('Sessions are not available.');
		}

		Template.loadHelpers(Path.join(SOURCE_DIR, 'helpers'));
		Template.loadHelpers(Path.join(APP_DIR, 'helpers'));
	},

	'_loadModels': function () {
		FileSystem.readdirSync(Path.join(APP_DIR, 'models')).forEach(function (filename) {
			if (filename.substring(filename.length - 3) === '.js') {
				require(Path.join(APP_DIR, 'models', filename));
			}
		});
	},

	'_startDb': function (callback) {
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

				if (typeof callback === 'function') {
					callback();
				}
			});
			break;
		default:
			if (typeof callback === 'function') {
				callback();
			}
		}
	},

	'_startServer': function () {
		this._server = Http.createServer(this._handleRequest.bind(this));
		this._server.listen(this._cfg.port);
		
		console.log('OK... Server is listening on ' + (this._cfg.domain || '*') + ':' + this._cfg.port + '.');
	},
	'_stopServer': function () {
		this._server.close();

		console.log('OK... Server stopped');
	},
	'_error': function (status, exc, request, response) {
		var controller = new Controller(request, response);
		controller.terminate(503, exc);
	},
	'_handleRequest': function (request, response) {
		if (this._cfg.domain && request.headers.host.split(':')[0] !== this._cfg.domain) {
			response.writeHead(404);
			response.end();
			return;
		}

		var app = this,
			uri = Url.parse(request.url).pathname,
			route;
		console.log(request.method + ' ' + uri);

		request = new HttpRequest(request);
		response = new HttpResponse(response);

		try {
			route = this.router.match(uri, request.url.split('?', 2)[1]);
		} catch (exc) {
			return app._error(503, exc, request, response);
		}
		if (route === null) {
			console.log('    ' + uri + ' --> static');
			return this._handleStaticRequest(uri, request, response);
		}

		var path = Path.join(APP_DIR, 'controllers', route.namespace, route.controller + '.js');
		Path.exists(path, function (exists) {
			if (!exists) {
				return app._error(404, 'Missing controller file: ' + route.controller, request, response);
			}

			var module = require(path);
			if (module.Controller === undefined) {
				return app._error(404, 'The file for the controller \'' + route.controller + '\' does not match the required output.', request, response);
			}

			request.on('ready', function () {
				var controller = new module.Controller(request, response, route);

				var fn = function (session) {
					if (session !== undefined) {
						controller.setSession(session);
						response.setCookie('FLOWONSESSID', session.id, app._cfg.session_expiration, undefined, '.' + request.host.replace(/:\d+$/, ''), false, true);
					}

					var execution_timeout = setTimeout(function () {
						if (!controller._rendered) {
							controller.terminate(503, 'Reached the maximum execution time of ' + app._cfg.max_execution_time + 's.');
						}
					}, app._cfg.max_execution_time * 1000);

					var startup_mode;
					try {
						startup_mode = controller.startup(route.params);
					} catch (exc) {
						return app._error(503, exc, request, response);
					}

					if (startup_mode === false) {
						return;
					} else if (startup_mode !== undefined) {
						switch (startup_mode) {
						case controller.NO_EXECUTION_LIMIT:
							clearTimeout(execution_timeout);
						}
					} else if (controller[route.view] === undefined) {
						return controller.render(200);
					} else {
						var mode = controller[route.view](route.params);
						if (mode !== undefined) {
							switch (mode) {
							case controller.NO_EXECUTION_LIMIT:
								clearTimeout(execution_timeout);
							}
						}
					}
				};
				
				var initSession = function (session) {
					session['date:created'] = Math.floor(new Date().getTime() / 1000);
					session.save(function () {
						fn(session);
					});
				};

				if (app.db !== undefined) {
					if (request.cookies.FLOWONSESSID) {
						Session.one(request.cookies.FLOWONSESSID, function (session) {
							if (!session.stored) {
								session['date:created'] = Math.floor(new Date().getTime() / 1000);
								session.save(initSession.bind(this, session));
							} else {
								fn(session);
							}
						});
					} else {
						initSession(new Session());
					}
				} else {
					fn();
				}
			});
		});
	},
	'_handleStaticRequest': function (uri, request, response) {
		var app = this,
			path = Path.join(PUBLIC_DIR, uri);
		Path.exists(path, function (exists) {
			if (!exists) {
				response.status = 404;
				return response.end();
			}

			FileSystem.readFile(path, 'binary', function (error, file) {
				if (error) {
					switch (error.errno) {
					case 21: // EISDIR
						if (uri[uri.length - 1] !== '/') {
							response.status = 301;
							response.setHeader('location', uri + '/');
							return response.end();
						}

						path = Path.join(path, 'index.html');
						Path.exists(path, function (exists) {
							if (!exists) {
								return app._error(403, 'Directory listing is not allowed.', request, response);
							}

							FileSystem.readFile(path, 'UTF-8', function (error, file) {
								if (error) {
									return app._error(500, error.toString(), request, response);
								}
								
								var ejs = new EJS({
									'text': file,
								});
								response.setHeaders(app.getHeadersByExtension('.html'));
								response.write(ejs.render(app.getStaticVariables(request, response)));
								response.end();
							});
						});
						return;
					default:
						return app._error(500, error.toString(), request, response);
					}
					return;
				}

				var ejs_extensions = ['.html', '.css'],
					ext = Path.extname(path);
				response.setHeaders(app.getHeadersByExtension(ext));
				if (ejs_extensions.indexOf(ext) !== -1) {
					var ejs = new EJS({
						'text': file
					});
					response.write(ejs.render(app.getStaticVariables(request, response)), 'UTF-8');
				} else {
					response.write(file, 'binary');
				}
				response.end();
			});
		});
	},
};

Object.defineProperties(app, {
	'_cfg': {
		'value': {
			'base_uri': '/',
			'port': 8124,
			'db_type': null,
			'max_execution_time': 15,
			'session_expiration': '+ 1 day',
		},
	},
	'router': {
		'value': new Router(),
		'writable': false,
	},
});

global.app = app;
