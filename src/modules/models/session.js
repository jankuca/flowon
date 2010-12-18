var Class = require(app.__dirname + 'modules/class.js').Class,
	_Model = require(app.__dirname + 'modules/model.js').Model;

var Model = exports.Model = Class.create(_Model, {
	'collection': 'sessions'
});