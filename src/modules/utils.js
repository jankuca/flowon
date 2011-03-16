(function () {

Object.defineProperty(Function.prototype, 'initializing', {
	value: false,
	writable: true,
});
Object.defineProperty(Function.prototype, '$super', {
	value: function () {
		throw new Error('The $super method is not available.');
	},
	writable: true,
});

Function.prototype.inherit = function (init, props) {
	if (arguments.length === 1 && typeof init !== 'function') {
		props = arguments[0];
		init = undefined;
	}
	props = props || {};

	var parent = this,
		prototype;
	try {
		this.initializing = true;
		prototype = new this();
		this.initializing = false;
	} catch (exc) {
		throw exc;//console.log('err: ' + exc);
		throw new Error('Not possible to inherit from this function');
	}

	var createChildMethod = function (key, fn) {
		return function () {
			var tmp = this.$super,
				_parent = parent.prototype,
				_super;
			do {
				_super = _parent;
				if (_parent.constructor === Object) {
					break;
				}
				_parent = Object.getPrototypeOf(_parent);
			} while (_super[key] === undefined);
			if (_super[key] !== undefined) {
				this.$super = _super[key];
			}
			var res = fn.apply(this, Array.prototype.slice.call(arguments));
			this.$super = tmp;
			return res;
		};
	};
	Object.getOwnPropertyNames(props).forEach(function (key) {
		if (typeof props[key] === 'function') {
			prototype[key] = createChildMethod(key, props[key]);
		} else {
			var desc = Object.getOwnPropertyDescriptor(prototype, key);
			if (desc === undefined || desc.configurable) {
				Object.defineProperty(prototype, key, Object.getOwnPropertyDescriptor(props, key));
			}
		}
	});

	var Function = function () {
		if (!this.constructor.initializing) {
			var args = Array.prototype.slice.call(arguments);
			if (parent !== global.Function) {
				parent.apply(this, args);
			}
			if (typeof init === 'function') {
				init.apply(this, args);
			}
		}
	};

	var skip = Object.getOwnPropertyNames(function () {}).concat(['__children__']);
	Object.getOwnPropertyNames(parent).forEach(function (key) {
		if (skip.indexOf(key) === -1) {
			Object.defineProperty(this, key, Object.getOwnPropertyDescriptor(parent, key));
		}
	}, Function);

	Function.prototype = prototype;
	prototype.constructor = Function;

	if (Object.getOwnPropertyDescriptor(this, '__children__') === undefined) {
		Object.defineProperty(this, '__children__', {
			value: [],
		});
	}
	this.__children__.push(Function);

	return Function;
};

Function.prototype.getChildFunctions = function () {
	return (this.__children__ !== undefined) ? this.__children__.slice() : [];
};


if (Array.prototype.first === undefined) {
    Array.prototype.first = function () {
        return this[0] || undefined;
    };
}
if (Array.prototype.last === undefined) {
    Array.prototype.last = function () {
        return this.length ? this[this.length - 1] : undefined;
    };
}

}());