var path = require('path');
var fs = require('fs');
var rfc6902 = require('rfc6902');

var dataPath = '../data/census_lang.json'
var patch = path.join(process.cwd(), process.argv[2]);

var data = require(dataPath);

rfc6902.applyPatch(data, require(patch));

fs.writeFileSync(path.join(__dirname, dataPath), JSON.stringify(data), 'utf8');
