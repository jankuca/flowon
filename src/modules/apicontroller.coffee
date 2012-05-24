module.exports.Controller = Controller = global.Controller.inherit ->
	@output = null

Controller::render = (status) ->
	status = Number status
	@_response.status = status unless isNaN status
	@header 'cache-control', 'no-cache'
	if @output
		@header 'content-type', 'application/json; charset=UTF-8'
		@_response.write JSON.stringifyFormatted @output

	do @_response.end
	do @clearMaxExecitionTimeout

Controller::terminate = (status, message) ->
	@output = null
	if message
		@output =
			error: message
	@render status

JSON.stringifyFormatted = (input) ->
	tab = '  '

	output = ''
	json = JSON.stringify input
	indent_level = 0
	in_string = no
	
	str_repeat = (str, count) ->
		out = ''
		out += str for i in [0...count]
		return out

	for c in [0...json.length]
		chr = json[c]
		switch chr
			when '{', '['
				output += chr + (if not in_string then "\n" + str_repeat tab, ++indent_level else '')
			when '}', ']'
				output += (if not in_string then "\n" + str_repeat tab, --indent_level else '') + chr
			when ','
				output += if not in_string then ",\n" + str_repeat tab, indent_level else chr
			when ':'
				output += if not in_string then ": " else chr;
			when '"'
				in_string = not in_string if c > 0 and json[c - 1] isnt '\\'
				output += chr
			else
				output += chr

	return output