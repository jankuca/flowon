# == utils ==
singular = (str) -> str.replace(/ies$/, 'y').replace(/s$/, '')
plural = (str) -> str.replace(/y$/, 'ies').replace(/[^s]$/, (a) -> a + 's')
ucFirst = (str) -> str.replace /^\w/, (w) -> do w.toUpperCase

# == module ==
Model = module.exports.Model = Function.inherit (doc) ->
	@doc = doc or {}
	@stored = Boolean @doc._id
	@deleted = Boolean @doc['date:deleted']
	@_ref = {}
	@_cache = {}
	do @_exportDoc
	do @_createTree
	do @_defineProperties
	return

# -- dynamic prototype properties --
Object.defineProperty Model.prototype, 'id',
	get: -> if @doc._id then do @doc._id.toString else null
	set: (val) ->
		@doc._id = if typeof val isnt 'object' then app.db.pkFactory val else val

Object.defineProperty Model.prototype, 'embedded',
	get: -> @constructor.embedded

# -- prototype --
Model::_defineProperties = ->
	changed = no
	Object.defineProperty this, 'changed',
		get: ->
			model = this
			doc = @doc
			changed or Object.keys(doc).every (key) -> doc[key] is model[key]
		set: (val) ->
			changed = Boolean val

Model::_createTree = ->
	doc = @doc

	_handleChild = (item, ChildModel) =>
		return app.db.pkFactory item if typeof item is 'string'
		return item if not ChildModel.embedded # item instanceof ObjectId

		child = new ChildModel item
		child._cache._parent = this
		return child

	Object.keys(doc).forEach (key) ->
		return if key.indexOf(':') isnt -1 || not @_doesHandle key

		items = doc[key]
		if items instanceof Array
			ChildModel = global[ucFirst singular key]
			child = items.map (item) -> _handleChild item, ChildModel unless ChildModel is undefined
		else
			ChildModel = global[ucFirst key]
			child = _handleChild items, ChildModel unless ChildModel is undefined
		this[if ChildModel.embedded then '_cache' else '_ref'][key] = child unless ChildModel is undefined
	, this

Model::_doesHandle = (key) ->
	typeof this['get' + ucFirst key] is 'function'

Model::_exportDoc = ->
	doc = @doc
	Object.keys(doc).forEach (key) ->
		this[key] = doc[key] unless key.indexOf(':') is -1
	, this

Model::getObjectId = -> @doc._id || null

Model::_fillDoc = ->
	do @_applyRef
	do @_applyCache

	doc = @doc
	Object.keys(this).forEach (key) ->
		return if key.indexOf(':') is -1
		@changed = yes if doc[key] isnt this[key]
		doc[key] = this[key]
	, this
	Object.keys(doc).forEach (key) ->
		empty = (doc[key] is undefined) or (doc[key] instanceof Array and doc[key].length is 0)
		delete doc[key] if empty

Model::_applyRef = ->
	doc = @doc
	ref = @_ref
	Object.keys(ref).forEach (key) -> doc[key] = ref[key]

Model::_applyCache = ->
	doc = @doc
	cache = @_cache
	Object.keys(cache).forEach (key) ->
		return unless @_doesHandle key
		child = cache[key]
		if child instanceof Array
			doc[key] = child.map (child) ->
				do child._fillDoc
				child.id = new app.db.pkFactory() if child.embedded and not child.id
				return child.doc
		else if not child
			doc[key] = undefined
		else
			do child._fillDoc
			child.id = new app.db.pkFactory() if child.embedded and not child.id
			doc[key] = child.doc
	, this

Model::save = (callback) ->
	do @_fillDoc
	@id = new app.db.pkFactory() if not @id

	if not @changed
		callback null unless typeof callback isnt 'function'
	else
		@beforeSave?()
		this[if not @embedded then '_save' else '_saveEmbedded'] (err) =>
			@deleted = Boolean @doc['date:deleted']
			callback err or null unless typeof callback isnt 'function'

Model::_save = (callback) ->
	@constructor.collection (err, collection) =>
		throw err if err
		collection.save @doc, insert: not @stored, (err) =>			
			@stored = yes
			do @_markEmbeddedAsStored
			callback err unless typeof callback isnt 'function'

Model::_saveEmbedded = (callback) ->
	@getParent (parent) =>
		return callback new Error 'Item is not embedded when it should be.' if not parent or not parent.stored
		parent.changed = @changed or parent.changed
		parent.save callback

Model::_markEmbeddedAsStored = ->
	cache = @_cache
	Object.keys(cache).forEach (key) ->
		items = cache[key]
		if items instanceof Array
			items.forEach (item) -> item.stored = yes
		else if items
			items.stored = yes

Model::remove = (callback) ->
	@updateTimestamp 'date:deleted'
	@save callback

Model::embed = (child) ->
	throw new Error 'Only models can be embedded.' if not child instanceof Model

	key = @_getChildAssoc child
	if @_doesHandle key # embeds one
		@changed = yes
		@_cache[key] = child
	else if @_doesHandle plural key # embeds many
		@changed = yes
		cache = @_cache[plural key] or []
		cache.push child
		@_cache[plural key] = cache

Model::ref = (child, key) ->
	throw new Error 'Only models can be referenced.' if not child instanceof Model
	throw new Error 'Only stored models can be referenced.' if not child.stored

	key ?= @_getChildAssoc child
	if @_doesHandle key # has one
		@changed = yes
		@_ref[key] = app.db.pkFactory child.id
	else if @_doesHandle plural key # has many
		@changed = yes
		ref = @_ref[plural key] or []
		ref.push app.db.pkFactory child.id
		@_ref[plural key] = ref

Model::_getChildAssoc = (child) ->
	ChildModel = null
	Model.getChildFunctions().some (Model) ->
		if child instanceof Model
			ChildModel = Model
			return true
	return ChildModel.key

Model::updateTimestamp = (keys...) ->
	ts = Math.round new Date().getTime() / 1000
	keys.forEach (key) ->
		@doc[key] = ts
	, this

# -- static --
Model.collection = (callback) ->
	app.db.collection (plural @key), callback

Model.define = (key, constructor, prototype) ->
	M = @inherit constructor, prototype
	M.key = key
	return M

Model.has_one = (assocs...) ->
	assocs.forEach (assoc) ->
		this['get' + ucFirst assoc] = (options, callback) ->
			if arguments.length is 1 and typeof arguments[0] is 'function'
				callback = arguments[0]
				options = {}

			selector = _id: @_ref[assoc]
			global[ucFirst assoc].one selector, options, callback
	, @prototype

Model.has_many = (assocs...) ->
	assocs.forEach (assoc) ->
		this['get' + ucFirst assoc] = (selector, options, callback) ->
			if arguments.length is 2 and typeof arguments[1] is 'function'
				callback = arguments[1]
				options = arguments[0]
			else if arguments.length is 1 and typeof arguments[0] is 'function'
				callback = arguments[0]
				options = {}
			selector = {} unless arguments.length is 3

			selector._id = $in: @_ref[assoc]
			global[ucFirst singular assoc].all selector, options, callback
	, @prototype

Model.embeds_one = (assocs...) ->
	assocs.forEach (assoc) ->
		this['get' + ucFirst assoc] = (callback) ->
			child = @_cache[assoc] or new global[ucFirst assoc]
			callback child unless typeof callback isnt 'function'
			return child
	, @prototype

Model.embeds_many = (assocs...) ->
	assocs.forEach (assoc) ->
		this['get' + ucFirst assoc] = (callback) ->
			children = @_cache[assoc] or []
			callback children unless typeof callback isnt 'function'
			return children
	, @prototype

Model.belongs_to = (key) ->
	@embedded = no
	@_parent_key = key
	@prototype.getParent = (callback) ->
		has_one = typeof global[ucFirst @constructor._parent_key].prototype['get' + ucFirst @key] is 'function'
		selector = {}
		selector[if has_one then @key else plural @key] = @id
		global[ucFirst @constructor._parent_key].one selector, callback

Model.embedded_in = (key) ->
	@embedded = yes
	@_parent_key = key
	@prototype.getParent = (callback) ->
		parent = @_cache._parent
		callback parent unless typeof callback isnt 'function'
		return parent

Model.one = (selector, options, callback) ->
	if arguments.length is 2 and typeof arguments[1] is 'function'
		callback = arguments[1]
		options = {}
	else if arguments.length is 1 and typeof arguments[0] is 'function'
		callback = arguments[0]
		options = {}
		selector = {}

	options.limit = 1
	@all selector, options, callback

Model.all = (selector, options, callback) ->
	if arguments.length is 2 and typeof arguments[1] is 'function'
		callback = arguments[1]
		options = {}
	else if arguments.length is 1 and typeof arguments[0] is 'function'
		callback = arguments[0]
		options = {}
		selector = {}
	throw new Error 'Missing callback' if typeof callback isnt 'function'

	selector = @_consolidateSelector selector
	selector.$or = [ ('date:deleted': $exists: no), 'date:deleted': 0 ] unless selector['date:deleted'] isnt undefined or options.deleted

	return @_allEmbedded selector, options, callback if @embedded
	@_all selector, options, callback

Model._consolidateSelector = (selector) ->
	if typeof selector isnt 'object'
		return _id: app.db.pkFactory selector
	else if selector._id isnt undefined
		selector._id = app.db.pkFactory selector._id
	return selector

Model._all = (selector, options, callback) ->
	@collection (err, collection) =>
		throw err if err
		collection.find selector, options, (err, docs) =>
			throw err if err
			docs.toArray (err, docs) =>
				return callback new this docs[0] if options.limit is 1
				callback docs.map (doc) ->
					new this doc
				, this

Model._allEmbedded = (selector, options, callback) ->
	ParentModel = global[ucFirst @_parent_key]
	embeds_one = typeof ParentModel.prototype['get' + ucFirst @key] is 'function'
	sel = @_embedSelector selector, if embeds_one then @key else plural @key

	ParentModel.collection (err, collection) =>
		throw err if err
		one = options.limit is 1
		collection.find sel, options, (err, docs) =>
			throw err if err
			docs.toArray (err, docs) =>
				if embeds_one
					return callback new this if docs.length is 0
					callback do (new ParentModel docs[0])['get' + ucFirst @key]
				else
					res = []
					docs.forEach (doc) ->
						children = do (new ParentModel doc)['get' + ucFirst plural @key]
						res = res.concat children.filter (child) => @_matchSelector selector, child
					, this
					return callback res[0] or new this if one
					callback res

Model._embedSelector = (selector, ns_key) ->
	sel = {}
	Object.keys(selector).forEach (key) ->
		if key is '$or'
			rule = selector[key]
			sel.$or = Object.keys(rule).map (a) ->
				@_embedSelector rule[a], ns_key
			, this
		else
			sel[ns_key + '.' + key] = selector[key]
	, this
	return sel

Model._matchSelector = (selector, child) ->
	doc = child.doc
	Object.keys(selector).every (key) =>
		val = selector[key]
		return do val.toString is child.id if key is '_id'
		if key isnt '$or'
			return val is doc[key] if typeof val isnt 'object'
			Object.keys(val).every (op) =>
				switch op.substr 1
					when 'in' then val[op].indexOf doc[key] isnt -1
					when 'nin' then val[op].indexOf doc[key] is -1
					when 'exists'
						if Boolean val[op]
							typeof doc[key] isnt 'undefined' and doc[key] isnt null
						else
							typeof doc[key] is 'undefined' or doc[key] is null
		else
			val.some (sel) => @_matchSelector sel, child

###
Model._matchSelector = (selector, child) ->
	Object.keys(selector).every (key) =>
		rule = selector[key]
		if key is '$or'
			rule.every (rule) => @_matchSelectorRule rule, child
		else
			@_matchSelectorRule rule, child

Model._matchSelectorRule = (rule, child) ->
	doc = child.doc
	if typeof rule isnt 'object'
		return do rule.toString is child.id if key is '_id'
		return rule is doc[key]
	Object.keys(rule).every (op) ->
		switch op.substr 1
			when 'in' then rule[op].indexOf(doc[key]) isnt -1
			when 'nin' then rule[op].indexOf(doc[key]) is -1
			when 'exists'
				if Boolean rule[op]
					typeof doc[key] isnt 'undefined' and doc[key] isnt null
				else
					typeof doc[key] is 'undefined' or doc[key] is null

###