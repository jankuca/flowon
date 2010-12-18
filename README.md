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
				this.template.user = user;
				this.render(200);
			}.bind(this)); // Prototype context binding; "this" in the function will reference the controller instance
		},

		'friends': function(params) {
			new User({ 'id': params.id }, function (user) {
				user.getFriends(['users:realname'], function (friends) {
					friends.toArray(function (error, friends) {
						this.template.friends = friends.toArray();
						this.render(200);
					}.bind(this));
				}.bind(this));
			}.bind(this));
		}
	});

## Models

It is recommended to inherit from the supplied Model class.

> Note that all field keys are namespaced as `NAMESPACE:KEY`. You can skip the namespace but have to leave the colon (`:KEY`).

	// app_dir/models/user.js:

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
				friend_ids.push(app.db.pkFactory(friend_refs[i].$id));
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

## Views / templates

FlowOn uses [EmbeddedJS](http://embeddedjs.com/) as its template engine.

Template files are stored in the `app_dir/templates/` directory. Router namespaces are also applied to this directory. Then, the full path is `app_dir/templates/[namespace/]controller/view.format.ejs`

> In the terms of providing the correct mime-type, only the `html` format is currently supported. Any other format will be send as text/plain.

	// app_dir/templates/user/show.html.ejs:

	<h1>Profile of <%= user['users:realname'] %></h1>

### Layouts

Every view can be encapsulated in a layout. Layout can be disabled by setting the `Controller#_layout_path` property to `undefined`.

Layout template files are stored in the same directory as regular view files, but prefixed with `@`. For instance, the full path of an HTML layout for the `admin` namespace is `app_dir/templates/admin/@layout.html.ejs`.

In the layout, there is the content of the current view accessible as `$content`.

	// app_dir/templates/@layout.html.ejs:
	
	<!DOCTYPE html>
	<html>
	...
	<body>
	<h1>FlowOn readme example</h1>
	
	<%= $content %>
	
	</body>
	</html>