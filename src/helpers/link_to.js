exports.helper = function (ncv, params, abs) {
	var ncv = ncv.split(':'),
		len = ncv.length,
		route = app.router.resolve({
			'namespace': ncv[len - 3] || null,
			'controller': ncv[len - 2] || this.controller._name || 'default',
			'view': ncv[len - 1] || 'default',
			'params': params
		}, abs);
	return route || 'javascript:;';
};