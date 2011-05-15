require.paths.unshift __dirname, __dirname + '/../lib/'

# libraries
require '../lib/utils/utils'
EJS = require('ejs/ejs').EJS

# modules
Router = require('modules/router').Router
HttpRequest = require('modules/httprequest').HttpRequest
HttpResponse = require('modules/httpresponse').HttpResponse
Template = require('modules/template').Template
global.Cache = require('modules/cache').Cache
global.Form = require('modules/form.js').Form
global.Model = require('modules/model').Model
global.Controller = require('modules/controller.coffee').Controller
global.ApiController = require('modules/apicontroller.coffee').Controller

HTTP = require 'http'
URL = require 'url'
Path = require 'path'
FS = require 'fs'

spawn = require('child_process').spawn

global.app =
	get: (key) -> @_cfg[key] or null
	set: (key, value) -> @_cfg[key] = value

	getHeadersByExtension: -> ContentServer.getHeadersByExtension.apply ContentServer, arguments

	_defineConstants: ->
		global.SOURCE_DIR = __dirname + '/'
		global.APP_DIR = @get 'app_dir'
		global.PUBLIC_DIR = @get 'public_dir'
	
	_loadModels: ->
		try
			model_dir = Path.join APP_DIR, 'models'
			files = FS.readdirSync Path.join model_dir
			files.forEach (f) ->
				ext = Path.extname f
				require Path.join model_dir, f unless ext isnt '.js' and ext isnt '.coffee'
			do @_loadSessionModel
		catch err
			throw err unless err.code is 'ENOENT'

	_loadSessionModel: ->
		if @db isnt undefined
			if global.Session is undefined
				require 'modules/models/session'
				console.info '-- Info: Using the built-in session model.'
			else
				console.info '-- Info: Using a custom session model.'
		else
			console.warn '-- Warning: Sessions are not available.'

	_startDB: (callback) ->
		type = @get 'db_type'
		driver = @get 'db_driver'
		console.warn '-- Warning: Starting without a database.' if type is null
		return console.error '-- Error: No database driver' if driver is null
		console.info "-- Info: Using the '#{@get 'db_type'}' database driver." unless not type

		switch type
			when 'mongodb' then @_startDb_mongodb callback
			else do callback unless callback isnt 'function'
	
	_startDb_mongodb: (callback) ->
		driver = @get 'db_driver'
		@db = new driver.Db (@get 'db_name'),
			new driver.Server (@get 'db_server'), (@get 'db_port'), {}
		@db.open (err) ->
			return console.error '-- Error: Connection to database failed:' + err if err
			console.info '== OK == Connected to the database'
			do callback unless typeof callback isnt 'function'

	_startServer: (callback) ->
		domain = @get('domain') or '*'
		port = @get 'port'

		@server = HTTP.createServer (req, res) ->
			server = new ContentServer req, res
			do server.route
		@server.listen port
		console.info "== OK == Server is listening on #{domain}:#{port}\n"

	run: (callback) ->
		do @_defineConstants
		Template.loadHelpers Path.join SOURCE_DIR, 'helpers'
		Template.loadHelpers Path.join APP_DIR, 'helpers'
		@_startDB =>
			do @_loadModels
			@_startServer callback


Object.defineProperties app,
	_cfg:
		value:
			base_uri: '/'
			port: 80
			db_type: null
			max_execution_time: 15
			session_expiration: '+ 1 day'
	router:
		value: do new Router


ContentServer = Function.inherit (req, res) ->
	@request = new HttpRequest req
	@response = new HttpResponse res
	@pathname = @request.url.pathname
	return

ContentServer::route = ->
	return @terminate 404 if not @_checkDomain
	try
		do @_route
	catch err
		@terminate 503, err

ContentServer::_checkDomain = ->
	domain = app.get 'domain'
	hostname = @request.headers.hostname.split '.'
	return not domain or domain is hostname.slice(-2).join '.'

ContentServer::_route = ->
	@route = route = app.router.match @request.url
	do @_logRequest
	return do @_readStaticFile if route is null
	try
		do @_routeToController
	catch err
		@terminate 503, err

ContentServer::_routeToController = ->
	route = @route
	path = Path.join APP_DIR, 'controllers', route.namespace, route.controller
	try
		Controller = require(path).Controller
	catch err
		return @terminate 503, err
		@terminate 404, "Missing controller file: #{if route.namespace then route.namespace + '/' else ''}#{route.controller}"
	return @terminate 503, "Invalid controller file: #{if route.namespace then route.namespace + '/' else ''}#{route.controller}" if typeof Controller is not 'function'
	@request.once 'ready', => @_prepareController Controller

ContentServer::_prepareController = (Controller) ->
	@controller = c = new Controller @request, @response, @route
	c.setMaxExecutionTimeout 1000 * app.get 'max_execution_time'
	return do @_startupController if app.db is undefined
	@_prepareSession (session) =>
		c.setSession session
		do @_startupController

ContentServer::_prepareSession = (callback) ->
	id = @request.cookies.FLOWONSESSID
	Session.one id, (session) =>
		return callback session if session.stored
		session.updateTimestamp 'date:created'
		session.save -> callback session

ContentServer::_startupController = ->
	route = do @controller.getRoute
	try
		return do @controller.view if not @controller.startup
		startup_mode = @controller.startup route.params
		return if startup_mode is false
		if startup_mode isnt undefined
			switch startup_mode
				when @controller.NO_EXECUTION_LIMIT
					do @controller.clearMaxExecitionTimeout
				else @terminate 503, 'Invalid startup mode'
		else
			do @controller.view
	catch err
		@terminate 503, err

ContentServer::_logRequest = (static) ->
	request = @request
	ts = do new Date().toUTCString
	url = "#{request.url.pathname}#{request.url.search}"
	console.log "[#{ts}][#{request.ip}] #{request.method} #{url}#{if @route is null then ' --> static' else ''}"

ContentServer::_readStaticFile = (unfiltered, error_callback) ->
	if arguments.length is 1 and typeof arguments[0] is 'function'
		error_callback = arguments[0]
		unfiltered = no

	path = Path.join PUBLIC_DIR, @pathname
	# filtered
	if not unfiltered
		return @_coffeeToJS path, error_callback if path.split('.').slice(-2).join('.') is 'coffee.js'
	# static
	Path.exists path, (exists) =>
		return do error_callback if not exists unless typeof error_callback isnt 'function'
		return @terminate 404 if not exists

		FS.readFile path, 'binary', (err, data) =>
			return @_handleStaticError err if err
			@_returnStaticData data

ContentServer::_coffeeToJS = (path, error_callback) ->
	src_path = path.replace(/\.coffee\.js$/, '.coffee')
	Cache.get 'coffee2js', path, (cache) =>
		FS.stat src_path, (err, src_stat) =>
			return do error_callback if err unless typeof error_callback isnt 'function'
			return @terminate 404 if err
			return @_returnStaticData cache.data if cache and cache.created > Math.round(src_stat.ctime.getTime() / 1000)

			data = ''
			error = no
			ch = spawn 'coffee', ['-c', '-p', src_path]
			ch.stdout.on 'data', (chunk) -> data += chunk
			ch.stdout.on 'end', =>
				if not error
					Cache.set 'coffee2js', path, data
					@_returnStaticData data
			ch.stderr.on 'data', (data) =>
				error = yes
				data = data.toString()
				err = new Error data.match(/,\s(.*)/)[1]
				err.stack = data
				@terminate 503, err

ContentServer::_handleStaticError = (err) ->
	switch err.errno
		when 21 then do @_handleStaticDir # EISDIR
		else @terminate 503, err.message

ContentServer::_handleStaticDir = ->
	try
		do @_redirectToCanonical
	catch err
	finally
		@pathname = Path.join @pathname, 'index.html'
		@_readStaticFile (err) =>
			@terminate 403, 'Directory listing is not allowed.'

ContentServer::_returnStaticData = (data) ->
	ext = Path.extname @pathname
	switch ext
		when '.html', '.css'
			ejs = new EJS text: data
			data = ejs.render
				base_uri: app.get 'base_uri'
				browser: @request.browser
				__request: @request
				__response: @response

	@response.setHeaders @constructor.getHeadersByExtension ext
	@response.write data, 'binary'
	do @response.end

ContentServer::_redirectToCanonical = ->
	pathname = @pathname
	throw new Error 'Already canonical' if pathname[pathname.length - 1] is '/'

	@response.status = 301
	@response.setHeader 'location', "#{pathname}/"
	do @response.end

ContentServer::terminate = (status, message) ->
	@controller = new Controller @request, @response
	@controller.terminate status, message

ContentServer.getHeadersByExtension = (ext) ->
	headers = @headers[ext] or {}

	if headers.expires is false
		delete headers.expires
	else
		headers['cache-control'] = 'public, must-revalidate'
	
	return headers


ContentServer.headers =
	'.html':
		'content-type': 'text/html; charset=UTF-8'
		expires: false
	'.js':
		'content-type': 'text/javascript; charset=UTF-8'
		expires: false
	'.css':
		'content-type': 'text/css; charset=UTF-8'
		expires: false
	'.manifest':
		'content-type': 'text/cache-manifest; charset=UTF-8'
		expires: false
