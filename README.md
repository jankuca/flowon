# FlowOn Node.js Framework #

FlowOn is a very simple but powerful MVC framework for building RIAs.

## Bootstrapping ##

	// boot.js:

	// Load the framework into a global variable
	require('./lib/flowon/src/flowon.js');
	// The framework object is loaded into the global object -> accessible as "app" at all time

	// Set up the environment
	app.set('app_dir', __dirname + '/app/');
	app.set('lib_dir', __dirname + '/lib/');
	app.set('public_dir', __dirname + '/public/');

	// (optional) Reference a database driver
	// Currently only MongoDB is supported via the node-mongodb-native package
	var mongodb = require('./lib/node-mongodb-native/lib/mongodb/');
	app.set('db_type', 'mongodb');
	app.set('db_name', 'test');
	app.set('db_server', '127.0.0.1');
	app.set('db_port', 27017);
	app.db_driver = mongodb;

	// Set up routes
	// The namespace is initially empty (i.e. the domain root)
	var router = app.getRouter();
	// domain index
	router.push('/', {
		'controller': 'index', // app_dir/controllers/index.js
		'view': 'index'
	});
	// namespace: /api/
	router.namespace('api');
	router.push('/user/:id', {
		'controller': 'user', // app_dir/controllers/api/user.js
		'view': 'show',
		'params': {
			'id': /^\d+$/
		}
	});
	router.push('/user/:id/friends', {
		'controller': 'user',
		'view': 'friends',
		'params': app.ROUTER_PARAM_INTEGER // sugar, batch setting
	});

	// Run the app
	app.run();

## Controllers

Controller files are stored in the `app_dir/controllers/` directory. Router namespaces are also applied to this directory.

	// app_dir/controllers/api/user.js:

	// Require needed modules
	var Class = require(app.__dirname + 'modules/class.js').Class,
		_Controller = require(app.__dirname + 'modules/controller.js').Controller,
		User = require(app._cfg.app_dir + 'models/user.js').Model;

	// Create the controller class; the inheritance engine is borrowed from the Prototype.js library
	var Controller = exports.Controller = Class.create(_Controller, {
		// Define the 'show' view
		'show': function (params) {
			new User({ 'id': params.id }, function (user) {
				this.response.writeHead(200);
				this.response.write(JSON.stringify(user.doc));
				this.response.end();
			}.bind(this)); // Prototype context binding; this in the function will reference the controller instance
		},

		'friends': function(params) {
			new User({ 'id': params.id }, function (user) {
				user.getFriends(['users:realname'], function (friends) {
					this.response.writeHead(200);
					this.response.write(JSON.stringify(friends));
					this.response.end();
				}.bind(this));
			}.bind(this));
		}
	});

## Models

It is recommended to inherit from the supplied Model class.

> Note that all field keys are namespaced as `NAMESPACE:KEY`. You can skip the namespace but have to leave the colon (`:KEY`).

	// app_dir/models/user.js

	// Require needed modules
	var Class = require(app.__dirname + 'modules/class.js').Class,
		_Model = require(app.__dirname + 'modules/controller.js').Model;
	
	var Model = exports.Model = Class.create(_Model, {
		'collection': 'users',

		'getFriends': function (fields, callback) {
			if (!this.exists()) {
				callback(false);
				return;
			}

			var friend_refs = this.doc.friends || [],
				friend_ids = [];
			for (var i = 0, ii = friend_refs.length; i < ii; ++i) {
				friend_ids.push(friend_refs[i].$id);
			}

			app.db.collection(this.collection, function (error, collection) {
				collection.find(
					{
						_id: { $in: friend_ids }
					},
					fields,
					function (error, cursor) {
						callback(cursor);
					}
				);
			});
		}
	});

