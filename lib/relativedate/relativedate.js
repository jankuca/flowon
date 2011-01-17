exports.parse = function (string, format) {
	var match = string.match(/^\+\s*(\d+)\s*([a-z]{3})/i);
	if (!match) {
		add = 0;
	} else {
		add = parseInt(match[1], 10);
		switch (match[2]) {
		case 'min':
			add *= 60;
			break;
		case 'hou':
			add *= 3600;
			break;
		case 'day':
			add *= 3600 * 24;
			break;
		case 'wee':
			add *= 3600 * 24 * 7;
			break;
		case 'mon':
			add *= 3600 * 24 * 30;
			break;
		case 'yea':
			add *= 3600 * 24 * 365;
			break;
		}
	}

	if (format) {
		var date = new Date();
		var now = date.getTime();
		date.setTime(now + add * 1000);
		return date[format]();
	}
	return add;
};