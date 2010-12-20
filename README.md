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
	app.setDbDriver(mongodb);

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

	router.namespace(null);
	// You can also set a wildcard routes
	router.push('/:_c/:_v', {
		'controller': ':_c', // reference the parameter :_c
		'view': ':_v', // reference the parameter :_v
		'params': /^[a-z][a-z0-9\-]*$/
	});
	router.push('/:_c', {
		'controller': ':_c', // reference the parameter :_c
		'view': 'default',
		'params': /^[a-z][a-z0-9\-]*$/
	});

	// Run the app
	app.run();

## Controllers

It is recommended to inherit from the supplied Controller class.

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
				this.template.user = user;

				user.getFriends(['users:realname'], function (friends) {
					friends.toArray(function (error, friends) {
						this.template.friends = friends.toArray();
						this.render(200);
					}.bind(this));
				}.bind(this));
			}.bind(this));
		}
	});

> Note that you have to explicitly tell the controller to render the view by calling the `Controller#render` method. There is a maximum execution limit after which the framework renders an error and closes the connection. To prevent this behavior for a single view, the view has to return `Controller#NO_EXECUTION_LIMIT`.

## Models

It is recommended to inherit from the supplied Model class.

Model files are stored in the `app_dir/models/` directory. Router namespaces are not applied to this directory.

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

> In the terms of providing the correct mime-type, only the `html` format is currently supported. Any other format will be sent as text/plain.

	// app_dir/templates/user/show.html.ejs:

	<h1>Profile of <%= user['users:realname'] %></h1>


	// app_dir/templates/user/friends.html.ejs

	<h1>Friends of <%= user['users:realanme'] %></h1>

	<ul>
	<% for (var i = 0, ii = friends.length; i < ii; ++i) { %>
		<li><%= friends[i]['users:realname'] %></li>
	<% } %>
	</ul>

All templates are cached so that EmbeddedJS does not have to compile the markup for every request. The Template class checks for changes and discards the cached version in case the original template file changed.

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

## Caching

The framework provides a very simple way to cache data. The Cache class can also interact with the widely used Memcached service.

If Memcached is not available, the system uses file-based cache located in the `app_dir/cache` directory.

	Cache.set('namespace', 'key', 'data', '+ 10 minutes', function () {
		// It looks like everything is OK even if the caching process failed.
		// It can happen and it is usually not a big deal.

		console.log('Cached!');
	});

	Cache.get('namespace', 'key', function (cache) {

		// Structure of the `cache` object:
		// {
		//   data: string - the actual cached data
		//   created: number - unix timestamp
		//   expires: number - unix timestamp; 0 = never expires
		// }

		var data;
		if (!cache) {
			// ... a time consuming operation ...
		} else {
			console.log('Cache loaded!', cache);
		}
	});

	Cache.remove('namespace, 'key', function () {
		console.log('Removed!');
	});