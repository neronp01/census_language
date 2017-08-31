/* eslint-env node, es6 */
var fs = require("fs");
var d3 = require("d3-dsv");
var langData = require("../lib/statcan_lang/i18n/en.json").en;
var familyKeys = Object.keys(langData.family);
var families = familyKeys.map(function(lang) {
  return langData.family[lang];
});
var categoryKeys = Object.keys(langData.category);
var categories = categoryKeys.map(function(lang) {
  return langData.category[lang];
});
var languageKeys = Object.keys(langData.lang);
var languages = languageKeys.map(function(lang) {
  return langData.lang[lang];
});
var output = {};
var currentGeo;
var currentObj;
var geoList = [];
var nonFamilies = [];
var nonLanguages = [];

fs.readFile("data/langdata.csv", "utf8", function(err, data) {
  var isGroup = function(row) {
      return row.SECOND_VIEW === "";
    },
    csv = d3.csvParse(data).sort(function(a,b) {
      var lengthDiff = a.GEOCODE.length - b.GEOCODE.length;
      if (lengthDiff !== 0) {
        return lengthDiff;
      }
      return parseInt(a.GEOCODE, 10) - parseInt(b.GEOCODE, 10);
    }),
    row, value;

  for (var r = 0; r < csv.length; r++){
    row = csv[r];
    value = null;

    if (row.GEOCODE === "00" || row.GEOCODE === "1")
      row.GEOCODE = "01";

    if (
        row.GEOCODE === "" ||
        row.GEOCODE.length > 3 ||
        parseInt(row.TOTAL, 10) === 0 ||
        row.LanguageEN === "Non-official language(s)"
      )
      continue;

    if (currentGeo === undefined || row.GEOCODE !== currentGeo) {
      currentGeo = row.GEOCODE;
      geoList.push(currentGeo);
      output[currentGeo] = currentObj = {
        langs: {},
        totals: {}
      };
    }

    value = parseInt(row.TOTAL, 10);

    if (isGroup(row) && row.LanguageEN !== "English" && row.LanguageEN !== "French") {
      // Is a total
      if(row.LanguageEN.substr(0, 5) === "Total") {
        currentObj.totals.total = value;
      } else if (categories.indexOf(row.LanguageEN) !== -1) {
        currentObj.totals[categoryKeys[categories.indexOf(row.LanguageEN)]] = value;
      } else if (families.indexOf(row.LanguageEN) !== -1) {
        currentObj.totals[familyKeys[families.indexOf(row.LanguageEN)]] = value;
      } else if (nonFamilies.indexOf(row.LanguageEN) === -1){
        nonFamilies.push(row.LanguageEN);
      }
    } else {
      // It's a language
      if(languages.indexOf(row.LanguageEN) !== -1) {
        currentObj.langs[languageKeys[languages.indexOf(row.LanguageEN)]] = value;
      } else if (nonLanguages.indexOf(row.LanguageEN) === -1) {
        nonLanguages.push(row.LanguageEN);
      }
    }
  }
  fs.writeFile("data/census_lang.json", JSON.stringify(output), "utf8");
  if (nonFamilies.length !== 0) {
    console.log("The following categories or families were not found: \n\t" + nonFamilies.join(",\n\t"));
  }
  if (nonLanguages.length !== 0) {
    console.log("The following languages were not found: \n\t" + nonLanguages.join(",\n\t"));
  }
});
