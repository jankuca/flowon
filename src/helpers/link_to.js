exports.helper = function (ncv, params, abs) {
	var router = app.getRouter(),
		ncv = ncv.split(':'),
		len = ncv.length,
		route = router.resolve({
			'namespace': ncv[len - 3] || null,
			'controller': ncv[len - 2] || 'default',
			'view': ncv[len - 1] || 'default',
			'params': params
		}, abs);
	return route || 'javascript:;';
};