exports.helper = function (key) {
	if (!this._controller) {
		throw 'No controller to get the form from.';
	}
	return this._controller.getForm(key);
};