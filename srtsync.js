#! /usr/bin/env node

var EventEmitter = require('events').EventEmitter;
var fs = require('fs');
var sprintf = require('sprintf').sprintf;
var util = require('util');

function time_to_str (ms) {
	var sign = '';

	if (ms < 0) {
		sign = '-';
		ms *= -1;
	}

	var hour = Math.floor(ms/3600000); ms -= hour*3600000;
	var min  = Math.floor(ms/60000); ms -= min*60000;
	var sec  = Math.floor(ms/1000); ms -= sec*1000;

	return sprintf('%s%02d:%02d:%02d,%03d', sign, hour, min, sec, ms);
};

function SubtitleReader (filepath) {

	if (! (this instanceof SubtitleReader)) {
		return new SubtitleReader(filepath);
	}

	EventEmitter.call(this);

	var self = this;
	var str_to_time = function (str) {
		var re = /^(\d\d):(\d\d):(\d\d),(\d\d\d)$/;
		var match = re.exec(str);
		return (
			Number(match[1]*3600)
			+ Number(match[2]*60)
			+ Number(match[3])
		)*1000 + Number(match[4]);
	};
	var rl = require('readline').createInterface({
		input: fs.createReadStream(filepath),
		output: new require('stream').Writable
	});
	var subtitle = { };

	var seq_reg =
		/^\uFEFF?(\d+)\s*$/;

	var time_reg =
		/^(\d\d:\d\d:\d\d,\d\d\d)[ \t]+-->[ \t]+(\d\d:\d\d:\d\d,\d\d\d)\s*$/;

	rl.on('line', function (line) {
		var match;

		if (match = seq_reg.exec(line)) {
			subtitle.seq = Number(match[1]);
		} else if (match = time_reg.exec(line)) {
			subtitle.bounds = {
				start: str_to_time(match[1]),
				stop: str_to_time(match[2])
			};
		} else {
			if (line.length === 0) {
				self.emit('subtitle', subtitle);
				subtitle = { };
			} else if (! subtitle.text) {
				subtitle.text = [ line ];
			} else {
				subtitle.text.push(line);
			}
		}
	});
	rl.on('error', function (err) {
		self.emit('error', err)
	});
	rl.on('close', function () {
		self.emit('close');
	});
};

util.inherits(SubtitleReader, EventEmitter);

var output = process.stdout;

set_output = function (argv, options) {
	output = fs.createWriteStream(options.output);
	// TODO check errors ...
};

show_version = function (argv, options) {
	console.log('v0.0.1');
	process.exit(0);
}

var more_details = 'Type « srtsync --help » for more details.';

var getopt = require('node-getopt').create([
		[ 'h', 'help',            'Display this help' ],
		[ 'o', 'output=FILE',     'Set output file. Default is standard output.'],
		[ 'v', 'version',         'Show version' ]
	])
	.setHelp(
		'Usage: srt-sync [OPTIONS] PATH_TO_SRT_FILE OFFSET|START'
		+ '\n' + 'Options:'
		+ '\n' + '[[OPTIONS]]'
		+ '\n'
		+ '\n' + 'Arguments:'
		+ '\n' + '  - PATH_TO_SRT_FILE is a path to an existing \'.srt\' file.'
		+ '\n' + '  - OFFSET: '
		+ '\n' + '    Format ::= [+|-]VALUEs|ms'
		+ '\n' + '    A relative number of seconds or milliseconds. Subtitles are shifted by'
		+ '\n' + '    the given value.'
		+ '\n' + '  - START:'
		+ '\n' + '    Format ::= [+|-][HH:][MM:]SS'
		+ '\n' + '    The time at which the subtitles should begin to appear. Subtitles are '
		+ '\n' + '    synchronised to start at the given value.'
		+ '\n'
		+ '\n' + 'In both case synchronised subtitles which should start before 00:00:00 are'
		+ '\n' + 'omitted.'
	)
	.bindHelp()
	.on('output', set_output)
	.on('version', show_version)
	.parseSystem();

try {
	if (getopt.argv.length < 2) {
		throw new Error(
			'Argument(s) missing.'
			+ '\n' + more_details
		);
	}

	var filepath = getopt.argv[0];
	var synchronise = (function(value) {
		var m;

		if (m = (/^(\+|-)?(?:(\d\d):)?(?:(\d\d):)?(\d\d)$/).exec(value)) {
			return (function(start) {
				var offset;
				return function(timevalue) {
					if (! offset) {
						offset = start - timevalue;
					}
					return timevalue + offset;
				};
			})((m[1] === '-' ? -1:1)*(Number(m[2]||0)*3600 + Number(m[3]||0)*60 + Number(m[4]))*1000);
		}

		if (m = (/^(\+|-)?(\d+)(s|ms)$/).exec(value)) {
			return (function (offset) {
				return function (timevalue) {
					return timevalue + offset;
				}
			})((m[1] === '-' ? -1:1)*Number(m[2])*(m[3] === 's' ? 1000:1));
		}

		throw new Error(
			'Wrong value for `OFFSET or START` argument.'
				+ '\n' + more_details
		);
	})(getopt.argv[1]);

	(new SubtitleReader(filepath))
		.on(
			'subtitle',
			function (subtitle) {
				var start = synchronise(subtitle.bounds.start),
					stop  = synchronise(subtitle.bounds.stop);

				if (start >= 0) {
					output.write(sprintf('%d\n', subtitle.seq));
					output.write(
						sprintf(
							'%s --> %s\n',
							time_to_str(start),
							time_to_str(stop)
						)
					);
					subtitle.text.forEach(function (text) {
						output.write(sprintf('%s\n', text));
					});
					output.write('\n');
				}
			}
		);

} catch (err) {
	console.error(err.message);
	process.exit(1);
}
