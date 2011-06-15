exports.helper = function (ncv, params, abs) {
	var ncv = ncv.split(':'),
		len = ncv.length,
		route = app.router.resolve({
			'namespace': ncv[len - 3] || this._controller._route.namespace || null,
			'controller': ncv[len - 2] || this._controller._route.controller,
			'view': ncv[len - 1] || 'default',
			'params': params
		}, abs);
	return route || 'javascript:;';
};