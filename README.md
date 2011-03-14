# FlowOn Node.js Framework #

FlowOn is a very simple but powerful MVC framework for building RIAs.

## Bootstrapping ##

	// boot.js:

	// Load the framework into a global variable
	require('./lib/flowon/src/flowon.js');
	// The framework object is loaded into the global object -> accessible as "app" at all time

	// Set up the environment
	app.set('port', 1100);
	app.set('domain', 'example.com');
	app.set('app_dir', __dirname + '/app/');
	app.set('lib_dir', __dirname + '/lib/');
	app.set('public_dir', __dirname + '/public/');

	app.set('session_expiration', '+ 1 year');

	// (optional) Reference a database driver
	// Currently only MongoDB is supported via the node-mongodb-native package
	app.set('db_type', 'mongodb');
	app.set('db_name', 'test');
	app.set('db_server', '127.0.0.1');
	app.set('db_port', 27017);
	app.setDbDriver(require('./lib/node-mongodb-native/lib/mongodb/'));

	// Set up routes
	// The namespace is initially empty (i.e. the domain root)
	var router = app.router;
	// domain index
	router.push('/', {
		'controller': 'index', // app_dir/controllers/index.js
		'view': 'index'
	});
	// namespace: /api/
	router.namespace = 'api';
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
		'params': router.PARAM_INTEGER // sugar, batch setting
	});

	router.namespace = null;
	// You can also set wildcard routes
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
	require(app._cfg.app_dir + 'models/user.js');

	// Create the controller class; FlowOn uses its own inheritance engine (Function.inherit)
	var Controller = exports.Controller = global.Controller.inherit({
		// Define the 'show' view
		'show': function (params) {
			User.one(params.id, function (user) {
				if (!user.exists()) {
					return this.terminate(404, 'No such user');
				}

				this.template.user = user;
				this.render(200);
			}.bind(this)); // Prototype context binding; "this" in the function will reference the controller instance
		},

		'friends': function(params) {
			User.one(params.id, function (user) {
				if (!user.exists()) {
					return this.terminate(404, 'No such user');
				}
				this.template.user = user;

				user.getFriends(['users:realname'], function (friends) {
					this.template.friends = friends.toArray();
					this.render(200);
				}.bind(this));
			}.bind(this));
		},
	});

> Note that you have to explicitly tell the controller to render the view by calling the `Controller#render` method. There is a maximum execution limit after which the framework renders an error and closes the connection. To prevent this behavior for a single view, the view has to return `Controller#NO_EXECUTION_LIMIT`.

## Models

Model files are stored in the `app_dir/models/` directory. Router namespaces are not applied to this directory.

> Note that all field keys are namespaced as `NAMESPACE:KEY`. You can skip the namespace but have to leave the colon (`:KEY`).

	// app_dir/models/user.js:

	// Require the factory object
	var Factory = require(app.__dirname + 'modules/model.js').Factory;
	
	var User = global.User = Model.inherit('user', {
		'getFriends': function (fields, callback) {
			if (!this.stored) {
				callback(false);
				return;
			}

			User.all({}, { 'fields': fields, 'sort': 'users:username' }, callback);
		},
	});

> We are working with anonymous functions. Therefore, we need to tell the Model.inherit method what do we want to define ('user').

Every model constructor has two static methods for fetching content from the database -- `Model.one` and `Model.all`.

	// get a user by their username
	User.one({ 'users:username': '...' }, function (user) {
		if (!user.stored) {
			// ... error probably
		} else {
			// ...
		}
	});

	// get all friends of a user (ID).
	// Note: This is a reverse operation to the "getFriends" method above.
	User.all({ 'friends': ID }, { 'sort': 'users:username' }, function (users) {
		// ... "users" is an array of User model instances

		console.log('The user ' + ID + ' got ' + users.length + 'friends.');
	});

> Models without a collection name specified represent embedded documents and such models do not have those static methods and are only retrievable using the model#get method.

### Associations

Associations between models are defined through the `has_one`, `has_many`, `belongs_to`, `embeds_one`, `embeds_many` and `embedded_in` methods.

	// book.js:
	var Book = Model.inherit('book');
	Book.has_many('chapters');

	// chapter.js:
	var Chapter = Model.inherit('chapter');
	Chapter.belongs_to('book');
	Chapter.embeds_many('paragraphs');

	// paragraph.js:
	var Paragraph = Model.inherit('paragraph');
	Paragraph.embedded_in('chapter');

Each of the methods defines a getter method for the given model. From the above example, each `Book` instance gets a `getChapters` method, each `Chapter` instance gets a `getParagraphs` method and a `getParent` method and each `Paragraph` instance also gets a `getParent` method.

	book.getChapters(function (chapters) {
		// ...
	});
	chapter.getParent(function (book) {
		// ...
	});

#### Association API

To associate `Model` instances, pass one to another's `ref` or `embed` method. `ref` creates a **reference association** (defined via the `has_one` and `has_many` methods) and `embed` **embeds** the whole model in the first one.

	var chapter = new Chapter();
	chapter[':title'] = 'Lorem ipsum';

	var p = new Paragraph();
	p[':content'] = '...';
	chapter.embed(p);

	chapter.save(function () {
		book.ref(chapter);
		book.save();
	});

> Note/todo: There is currently no API method for removing associatied documents. However, the `model#remove` method will eventually be able to clean association to its parent document.

The `model#remove` method removes an object from its collection but does not remove associations from parent documents. This is an open issue and it is in development.

## Views / templates

FlowOn uses [EmbeddedJS](http://embeddedjs.com/) as its template engine.

Template files are stored in the `app_dir/templates/` directory. Router namespaces are also applied to this directory. Then, the full path is `app_dir/templates/[namespace/]controller/view.format.ejs`

> In the terms of providing the correct mime-type, only the `html` format is currently supported. Any other format will be sent as text/plain.

	// app_dir/templates/user/show.html.ejs:

	<h1>Profile of <%= user['users:realname'] %></h1>


	// app_dir/templates/user/friends.html.ejs:

	<h1>Friends of <%= user['users:realanme'] %></h1>

	<ul>
	<% friends.forEach(function (friend) { %>
		<li><%= friend['users:realname'] %></li>
	<% }) %>
	</ul>

All templates are cached so that EmbeddedJS does not have to compile the markup for every request. The Template class checks for changes and discards the cached version in case the original template file changed.

### Layouts

Every view can be encapsulated in a layout. Layout can be disabled by passing `null` as the argument to the `Controller#template.setLayout` method.

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

### Helpers

The templating system is extensible via so called helpers. Those are basically functions available in the template files.

Each helper is defined in a separate file in the `app_dir/helpers` directory.

As an example, here is a code for a helper that converts an unix timestamp to the UTC date format:

	// app_dir/helper/unix2utc.js:

	exports.helper = function (unix) {
		return new Date(unix * 1000).toUTCString();
	};

> Note that every helper function has to be assigned to the `helper` property of the module's `exports` object. The actual function name is taken from the filename.

There is maybe no need to show the usage in a template file -- it's as simple as:

	// *.ejs:

	<p>Posted on <%= unix2utc(1234567890) %>.</p>

#### link_to

There is a very important build-in helper -- `link_to`. It is the simpliest way to create links within the app. It takes a string formed from the target namespace, controller and view joined by a colon (`:`).

	// Simple link
	<a href="<%= link_to('homepage:') %>">Homepage</a>

	// Link with parameters
	<a href="<%= link_to('user:friends', { 'id': 123 }) %>">Friends</a>

	// Link to another namespace
	<a href="<% link_to('admin:stats:') %>"></a>

As you can see from the examples, the pattern for the first argument is: `[namespace:]controller:[view]` If the view part is missing, `default` is passed to the router.

## Caching

The framework provides a very simple way to cache data. The Cache class will also be able to interact with the widely used Memcached service in the future.

Currently (and when Memcached is not available), the system uses file-based cache located in the `app_dir/cache` directory.

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