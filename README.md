sync-srt
========

Imagine you have the latest episode of your favorite sitcom and a ".srt"
subtitles files for it, unfortunately your subtitles are for an other
version and when you watch your video you get a lag between the displayed
subtitles and the video, and no way to find the right subtitles !
**srt-sync** is for you!


## Prerequisite

You will need [node.js](http://nodejs.org/) installed on your system.


## Setup

```shell
~> npm install -g git+https://github.com/NealRame/sync-srt.git
```

## Usage

```shell
~> srt-sync [OPTIONS] SRT_SUBTITLES_FILE OFFSET|START
```

### OPTIONS
Available options are:

* `-h, --help`

  Display help and exit.

* `-o, --output=FILE`

  Output the synchronised subtitles in the specified files.

* `-v, --version`

  Display version and exit.


### Using OFFSET

    OFFSET ::= [+|-]VALUEms|s

Offset represents a relative amount of time which are added to each section.
Synchronised section which should begin before _00:00:00_ are omitted.


### Using START

    START ::= [+|-][HH:][MM:]SS

The time at which the subtitles should begin to appear. Subtitles are
synchronised to start at the given value.

An offset is computed using the time at which the subtitles in the current file
actually starts like this :

    OFFSET = INITIAL_START_TIME - START

This offset is added to each section.
Synchronised section which should begin before _00:00:00_ are omitted.
