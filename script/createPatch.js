var path = require('path');
var rfc6902 = require('rfc6902');
var compareTo = path.join(process.cwd(), process.argv[2]);
var patch = rfc6902.createPatch(require('../data/census_lang.json'), require(compareTo));

process.stdout.write(JSON.stringify(patch) + "\n");
