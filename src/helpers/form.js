exports.helper = function (key) {
	if (!this.controller) {
		throw 'No controller to get the form from.';
	}
	return this.controller.getForm(key);
};