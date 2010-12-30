exports.helper = function (markup) {
	return markup.replace(/<\/?[\w:]+(\s*[\w:-]+="?[^>]+"?)*>/, '');
};