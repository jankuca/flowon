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

Controller::terminate = (status, message) ->
	@output = null
	if message
		@output =
			error: message
	@render status


JSON.stringifySorted = (input) ->
	output = ''
	if input instanceof Array
		output += '['
		output += input.map((item) -> JSON.stringifySorted item).join ','
		output += ']'
	else if input is null
		output += 'null'
	else
		switch typeof input
			when 'undefined' then output += 'null'
			when 'string' then output += '"' + input.replace(/"/g, '\\"') + '"'
			when 'number'
				if isNaN input
					output += 'null'
				else
					output += input
			when 'boolean' then output += input
			when 'object'
				output += '{'
				output += Object.keys(input).sort().map((key) -> '"' + key + '":' + JSON.stringifySorted input[key]).join ','
				output += '}'
	return output

JSON.stringifyFormatted = (input) ->
	tab = '  '

	output = ''
	json = JSON.stringifySorted input
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