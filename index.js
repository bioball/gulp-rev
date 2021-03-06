'use strict';
var crypto = require('crypto');
var path = require('path');
var gutil = require('gulp-util');
var through = require('through2');
var objectAssign = require('object-assign');

function md5(str) {
	return crypto.createHash('md5').update(str).digest('hex');
}

function relPath(base, filePath) {
	if (filePath.indexOf(base) !== 0) {
		return filePath;
	}
	var newPath = filePath.substr(base.length);
	if (newPath[0] === path.sep) {
		return newPath.substr(1);
	} else {
		return newPath;
	}
}

var plugin = function (opts) {
	opts = opts || {};
	return through.obj(function (file, enc, cb) {
		if (file.isNull()) {
			cb(null, file);
			return;
		}

		if (file.isStream()) {
			cb(new gutil.PluginError('gulp-rev', 'Streaming not supported'));
			return;
		}
		
		if (opts.base){
			file.path = file.path.split(opts.base).join('')
		}

		// save the old path for later
		file.revOrigPath = file.path;
		file.revOrigBase = file.base;
		
		var hashLength = opts.hashLength ? Math.max(opts.hashLength, 32) : 8;

		var hash = file.revHash = md5(file.contents).slice(0, hashLength);
		var ext = path.extname(file.path);
		var filename = path.basename(file.path, ext) + '-' + hash + ext;
		file.path = path.join(path.dirname(file.path), filename);
		cb(null, file);
	});
};

plugin.manifest = function (opt) {
	opt = objectAssign({path: 'rev-manifest.json'}, opt || {});
	var manifest = {};
	var firstFile = null;

	return through.obj(function (file, enc, cb) {
		// ignore all non-rev'd files
		if (!file.path || !file.revOrigPath) {
			cb();
			return;
		}

		// Combine previous manifest. Only add if key isn't already there.
		if (opt.path == file.revOrigPath) {
			var existingManifest = JSON.parse(file.contents.toString());
			manifest = objectAssign(existingManifest, manifest);
		// Add file to manifest
		} else {
			firstFile = firstFile || file;
			manifest[relPath(firstFile.revOrigBase, file.revOrigPath)] = relPath(firstFile.base, file.path);
		}

		cb();
	}, function (cb) {
		if (firstFile) {
			this.push(new gutil.File({
				cwd: firstFile.cwd,
				base: firstFile.base,
				path: path.join(firstFile.base, opt.path),
				contents: new Buffer(JSON.stringify(manifest, null, '  '))
			}));
		}

		cb();
	});
};

module.exports = plugin;
