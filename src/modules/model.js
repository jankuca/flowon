var Class = require(app.__dirname + 'modules/class.js').Class;

var Model = exports.Model = Class.create({
	'initialize': function (filter, callback) {
		if (this.collection === undefined) {
			return;
		}

		if (callback === undefined && typeof filter == 'function') {
			callback = filter;
			filter = undefined;
		}

		if (filter !== undefined && typeof filter != 'function') {
			if (typeof filter == 'string') {
				filter = {
					'_id': new app.db.pkFactory(filter)
				};
			} else if (typeof filter != 'object') {
				throw 'Invalid filter type';
			}

			filter['date:deleted'] = { $exists: false };

			app.db.collection(this.collection, function (error, collection) {
				collection.findOne(filter, function (error, doc) {
					if (doc === undefined) {
						this.doc = {};
					} else {
						this.doc = doc;

						for (var i in doc) {
							if (doc.hasOwnProperty(i)) {
								this[i] = doc[i];
							}
						}
					}

					if (typeof callback == 'function') {
						callback(this);
					}
				}.bind(this));
			}.bind(this));
		} else {
			// new document
			this.doc = {};

			if (typeof callback == 'function') {
				callback(this);
			}
		}
	},
	
	'exists': function () {
		return (this.doc !== undefined && this.doc._id);
	},
	'save': function (callback) {
		if (!this.exists()) {
			if (!this['date:created']) {
				this['date:created'] = Math.round(new Date().getTime() / 1000);
			}
			if (!this['date:modified']) {
				this['date:modified'] = Math.round(new Date().getTime() / 1000);
			}
		} else {
			if (this['date:modified'] == this.doc['date:modified']) {
				this['date:modified'] = Math.round(new Date().getTime() / 1000);
			}
		}

		for (var i in this) {
			if (this.hasOwnProperty(i)) {
				if (i.search(':') == -1) {
					continue;
				}

				this.doc[i] = this[i];
			}
		}

		app.db.collection(this.collection, function (error, collection) {
			if (error) {
				callback(error);
			} else {
				collection.save(this.doc, {}, function (error) {
					if (typeof callback == 'function') {
						callback(error);
					}
				}.bind(this));
			}
		}.bind(this));
	},
	'getId': function () {
		return this.doc._id;
	}
});