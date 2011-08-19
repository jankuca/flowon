Path = require 'path'

Template = require('modules/template').Template

module.exports.Controller = Controller = Function.inherit (request, response, route) ->
	@_request = request
	@_response = response
	@_route = route unless not route

	@method = request.method
	@input = request.data
	@domain = request.domain
	@subdomain = request.url.hostname.split('.').slice(-3, -2)[0]
	@host = request.url.host
	@xhr = Boolean request.headers['x-requested-with']?.match /xmlhttprequest/i

	@_rendered = no
	@_forms = {}
	@_session = null

	do @_prepareTemplate

Object.defineProperties Controller.prototype,
	NO_EXECUTION_LIMIT:
		value: 2

Controller::_prepareTemplate = ->
	@template = new Template this

	ns = @_route.namespace unless not @_route
	@template.setLayout if ns then "#{ns}/layout" else 'layout'

	@template.base_uri = app.get 'base_uri'
	@template.browser = @_request.browser
	@template.route = @_route
	@template.params = @_route.params unless not @_route

Controller::view = ->
	view = @_route.view
	return @render 200 if typeof this[view] isnt 'function'

	mode = this[view] @_route.params
	if mode
		switch mode
			when @NO_EXECUTION_LIMIT then do @clearMaxExecitionTimeout
			else @terminate 503, 'Invalid view mode'

Controller::header = (key, value) ->
	return @_request.getHeader key if value is undefined
	@_response.setHeader key, value

Controller::cookie = (key, value, expires, secure, httponly, level) ->
	if arguments.length is 1
		return if @_response.cookies[key] isnt undefined then @_response.cookies[key] else null

	url = @_request.url
	if level is 2
		domain = ".#{@domain}"
	else if level is 3
		domain = ".#{@subdomain}.#{@domain}"
	else
		domain = ".#{url.hostname}"

	@_response.setCookie key, value, expires, null, domain, Boolean(secure), Boolean(httponly)

Controller::getSession = -> @_session or null
Controller::setSession = (session) ->
	@cookie 'FLOWONSESSID', session.id, app.get('session_expiration'), no, yes, app.get('session_domain_level')
	session.doc['_domain'] = @domain
	session.save() # detached thread
	@_session = session or null

Controller::setMaxExecutionTimeout = (delay) ->
	@_max_execution_timeout = setTimeout =>
		@terminate 503, "Reached the maximum exection time of #{0.1 * Math.round delay / 100}s." if not @_rendered
	, delay

Controller::clearMaxExecitionTimeout = ->
	clearTimeout @_max_execution_timeout

Controller::getRequest = -> @_request
Controller::getResponse = -> @_response
Controller::getRoute = -> @_route

Controller::getForm = (key) ->
	return @_forms[key] unless @_forms[key] is undefined
	@_forms[key] = new Form key, @_request

Controller::link = (ncv, params, abs) ->
	url = @_request.url

	return "#{url.pathname}#{url.search or ''}" if arguments.length is 0
	return url.href if arguments.length is 1 and typeof arguments[0] is 'boolean'

	if arguments.length is 2 and typeof arguments[1] is 'boolean'
		abs = arguments[1]
		params = undefined
	
	ncv = ncv.split ':'
	len = ncv.length
	pathname = app.router.resolve
		namespace: ncv[len - 3] or @_route.namespace or null
		controller: ncv[len - 2] or @_route.controller or null
		view: ncv[len - 1] or 'default'
		params: params

	return '#' if !pathname
	return "#{url.protocol}//#{url.host}#{pathname}" if abs
	return pathname

Controller::redirect = (ncv, params) ->
	@header 'location', @link.apply this, arguments
	@terminate 302

Controller::terminate = (status, message) ->
	return if @_rendered

	status = Number status
	if not isNaN status
		@_response.status = status
	else
		message = arguments[0]
	
	return do @_response.end unless message
	@_terminateWithMessage message

Controller::_terminateWithMessage = (message) ->
	@template.setLayout null
	@template.setPath Path.join SOURCE_DIR, 'templates', 'error.html.ejs'
	@template.status = @_response.status
	@template.message = message.toString()
	@template.stack = message.stack if message instanceof Error
	@template.render (err, body) =>
		if err
			@header 'content-type', 'text/plain; charset=UTF-8'
			body = """
				Application error: #{message}
				Rendering error:   #{error}"""
		@_finishRendering body, Boolean err

Controller::_finishRendering = (body, no_headers) ->
	@_response.setHeaders app.getHeadersByExtension '.html' unless no_headers
	@_response.write body
	@_rendered = yes
	do @clearMaxExecitionTimeout
	do @_response.end

Controller::render = (status) ->
	return if @_rendered

	status = Number status
	@_response.status = status unless isNaN status

	if not @template.getPath()
		@template.setPath Path.join APP_DIR, 'templates', @_route.namespace, @_route.controller, "#{@_route.view}.html.ejs"
	@template.render (err, body) =>
		if err
			err.message = "Rendering error: #{err.message}"
			return @terminate 503, err
		@_finishRendering body