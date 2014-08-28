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
		'Usage: srt-sync [OPTIONS] PATH_TO_SUBTITLES_FILE [+|-]TIME_VALUE'
		+ '\n' + 'Options:'
		+ '\n' + '[[OPTIONS]]'
		+ '\n'
		+ '\n' + 'Arguments:'
		+ '\n' + '- PATH_TO_SUBTITLES_FILE is a path to an existing \'.srt\' file.'
		+ '\n' + '- TIME_VALUE format:'
		+ '\n' + '  * VALUE[s|ms], a number of seconds or milliseconds,'
		+ '\n' + '  * [HH:][MM:]SS'
		+ '\n'
		+ '\n' + 'If TIME_VALUE starts with a \'+\', all bounds are increased by the given value.'
		+ '\n' + 'If TIME_VALUE starts with a \'-\', all bounds are decreased by the given value.'
		+ '\n' + 'Otherwise, subtitles are synchronised to start at the given value.'
		+ '\n'
	)
	.bindHelp()
	.on('output', set_output)
	.on('version', show_version)
	.parseSystem();

if (getopt.argv.length < 2) {
	console.error(
		'Argument(s) missing.'
		+ '\n' + more_details);
	process.exit(1);
}

var filepath = getopt.argv[0];

var synchronise = (function(value) {
	var to_ms = function(v) {
		var match, ms;

		if (match = (/^(?:(\d\d):)?(?:(\d\d):)?(\d\d)$/).exec(v)) {
			ms =  Number(match[1] || 0)*3600000
				+ Number(match[2] || 0)*60000
				+ Number(match[3]     )*1000;
		} else if (match = (/^(\d+)ms/)) {
			ms =  Number(match[1]);
		} else if (match = (/^(\d)s/)) {
			ms =  Number(match[1])*1000;
		} else {
			throw new Error(
				'Wrong value for `OFFSET` argument.'
					+ '\n' + more_details
			);
		}

		return ms;
	};

	try {
		switch (value[0]) {
		case '+':
			return (function(value) {
				var offset = to_ms(value);
				return function(timevalue) {
					return time_to_str(timevalue + offset);
				};
			})(value.substr(1));

		case '-':
			return (function(value) {
				var offset = to_ms(value);
				return function(timevalue) {
					return time_to_str(timevalue - offset);
				}
			})(value.substr(1));

		default:
			return (function() {
				var start = to_ms(value);
				var offset;
				return function(timevalue) {
					if (! offset) {
						offset = start - timevalue;
					}
					return time_to_str(timevalue + offset);
				};
			})();
		}
	} catch (err) {
		console.error(err.messsage);
		process.exit(1);
	}

})(getopt.argv[1]);

(new SubtitleReader(filepath))
	.on(
		'subtitle',
		function (subtitle) {
			output.write(sprintf('%d\n', subtitle.seq));
			output.write(
				sprintf(
					'%s --> %s\n',
					synchronise(subtitle.bounds.start),
					synchronise(subtitle.bounds.stop)
				)
			);
			subtitle.text.forEach(function (text) {
				output.write(sprintf('%s\n', text));
			});
			output.write('\n');
		}
	);
