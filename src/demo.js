var sgcI18nRoot = "lib/statcan_sgc/i18n/sgc/",
  langI18nRoot = "lib/statcan_lang/i18n/",
  rootI18nRoot = "src/i18n/",
  sgcDataUrl = "lib/statcan_sgc/sgc.json",
  langDataUrl = "lib/statcan_lang/lang.json",
  canadaLangDataUrl = "data/census_lang.json",
  container = d3.select(".langs .data"),
  title = container.append("h2")
    .attr("id", "geo"),
  chart = container.append("svg")
    .attr("id", "canada_lang"),
  table = d3.select(".langs .table").append("table")
    .attr("class", "table")
    .attr("id", "chrt-dt-tbl")
    .attr("aria-labelledby", "geo"),
  groupTitle = chart.append("text")
    .attr("class", "group-title"),
  hoverText = chart.append("text")
    .attr("y", "350")
    .attr("class", "hover")
    .attr("aria-hidden", "true"),
  canadaSgc = "01",
  currentSgcId = canadaSgc,
  groupPrefix = "g_",
  categories = {},
  families = {},
  catOrder = [groupPrefix + "offiL", groupPrefix + "aboriL", groupPrefix + "immigL", groupPrefix+ "otherL"],
  $viewsList = $("#view_list"),
  valueFormatter = i18n.getNumberFormatter(0),
  percentFormatter = i18n.getNumberFormatter(1),
  bubbleColor = d3.color(d3.stcExt.getStyleRuleValue("fill", ".bubble circle")),
  bubbleColorEdge = (function() {
    var color = d3.hsl(bubbleColor);
    color.l *= 1.6;
    return color;
  })(),
  settings = {
    margin: {
      top: 20,
      right: 0,
      bottom: 30,
      left: 0
    },
    aspectRatio: 16 / 11,
    padding: 5,
    x: {
      getValue: function(d){
        return d.data.lang;
      },
      getText: function(d, i, sel, short) {
        return getLangi18n(this.x.getValue.call(this, d), short);
      }
    },
    y: {
      getValue: function(d) {
        if (d.value !== undefined)
          return d.value;

        return d.data ? d.data.value : null;
      },
      getText: function(d) {
        return valueFormatter.format(this.y.getValue.call(this, d));
      },
      getPercentageValue: function(d, group) {
        return d.data.percentages[group];
      },
      getPercentageText: function() {
        var value = this.y.getPercentageValue.apply(this, arguments);
        if (value !== undefined) {
          if (value > 0 && value < 0.001)
            return i18next.t("less_1pt", {ns: "census_lang"});
          return percentFormatter.format(value * 100);
        }
      }
    },
    z: {
      getId: function(d) {
        return d.data.lang;
      },
      getClass: function(d) {
        var langDef = getLangDef(d.data.lang),
          cl = "";

        if (isNaN(d.r) || d.r === 0 || (currentView !== defaultView && d.r < 10)) {
          cl = "text-hidden ";
        }

        if (langDef) {
          cl += langDef.category + " " + langDef.family;
        } else if (categories[d.data.lang]) {
          cl += "category";
        } else if (families[d.data.lang]) {
          cl += "family";
        }

        return cl;
      },
      getBubbleStyle: function(d) {
        var percentage = 0;
        if (d.data.percentages) {
          percentage = d.data.percentages.category || d.data.percentages.total;
        }
        return {
          fill: d3.color(interpolate(percentage))
        };
      }
    }
  },
  interpolate = d3.interpolateRgb(bubbleColorEdge, bubbleColor),
  categorizeLanguages = function() {
    var genericSuffixes = ["-x-nos", "-x-nie"],
      lang, l, cat, fam, s;
    for (l = 0; l < langData.length; l++) {
      lang = langData[l];
      cat = groupPrefix + lang.category;
      fam = groupPrefix + lang.family;

      if (!categories[cat])
        categories[cat] = [];
      if (!families[fam])
        families[fam] = [];

      if (lang.generic === true) {
        langDataIndex.push(lang.langId);
        for (s = 0; s < genericSuffixes.length; s++) {
          categories[cat].push(lang.langId + genericSuffixes[s]);
          families[fam].push(lang.langId + genericSuffixes[s]);
        }
      } else {
        langDataIndex.push(lang.langId);
        categories[cat].push(lang.langId);
        families[fam].push(lang.langId);
      }
    }
  },
  getLangDef = function(lang) {
    var genericSuffix = "-x-",
      newLang = lang.indexOf(genericSuffix) !== -1 ? lang.substr(0, lang.indexOf(genericSuffix)) : lang;
    return langData[langDataIndex.indexOf(newLang)];
  },
  processLangData = function(data) {
    var rtn = {},
      geos = Object.keys(data),
      g, geo, geoLangs, totalKeys, t, total, langs, l, lang, langDef, value;

    for (g = 0; g < geos.length; g++) {
      geo = geos[g];
      totalKeys = Object.keys(data[geo].totals);
      rtn[geo] = geoLangs = $.extend({}, data[geo].langs);

      for (t = 0; t < totalKeys.length; t++) {
        total = totalKeys[t];
        geoLangs[(total !== "total" ? groupPrefix : "") + total] = data[geo].totals[total];
      }

      //Calculate the percentages
      langs = Object.keys(geoLangs);
      langs.splice(langs.indexOf("total"), 1);
      percentages[geo] = {};
      for(l = 0; l < langs.length; l++) {
        lang = langs[l];
        langDef = getLangDef(lang);
        value = geoLangs[lang];
        percentages[geo][lang] = {
          total: value / geoLangs.total,
        };

        if (langDef) {
          if (geoLangs[groupPrefix + langDef.category]) {
            percentages[geo][lang].category = value / geoLangs[groupPrefix + langDef.category];
          }
          if (geoLangs[groupPrefix + langDef.family]) {
            percentages[geo][lang].family = value / geoLangs[groupPrefix + langDef.family];
          }
        }
      }
    }

    return rtn;
  },
  isGroup = function(lang) {
    return lang.substr(0, groupPrefix.length) === groupPrefix;
  },
  getSGCText = function(sgcId) {
    var text = i18next.t("sgc_" + sgcId, {ns: "sgc"}),
      sgcDef;

    if (sgcId.length > 2) {
      sgcDef = sgcData.sgcs.filter(function(s) {
        return s.sgcId === sgcId;
      });

      if (sgcDef && sgcDef.length > 0) {
        text += ", " + i18next.t(sgcDef[0].type, {ns: "sgc_type"});
      }

      text += ", " + i18next.t("sgc_" + sgc.sgc.getProvince(sgcId), {ns: "sgc"});
    }
    return text;
  },
  getLangi18n = function(lang, short) {
    var ns = ["category", "family"];
    if (isGroup(lang)) {
      lang = lang.substr(groupPrefix.length);
    } else {
      ns.push("lang");
    }
    return i18next.t(short !== false ? [lang + "_short", lang] : lang, {ns: ns});
  },
  createViews = function() {
    var getOption = function(id, text) {
        return "<option id='" + langs + "' selected>" + text + "</option>";
      },
      langs, langsList, fams, f, fam;
    views = {
      default: {
        langs: ["eng", "fra", groupPrefix + "aboriL", groupPrefix + "immigL"]
      },
      "+g_aboriL": {
        langs: categories[groupPrefix + "aboriL"],
        title: getLangi18n(groupPrefix + "aboriL")
      },
      "+g_immigL": {
        langs: categories[groupPrefix + "immigL"],
        title: getLangi18n(groupPrefix + "immigL")
      },
      "cat": {
        langs: Object.keys(categories),
        title: i18next.t("lang_cat", {ns: "census_lang"})
      },
      "fam": {
        langs: Object.keys(families),
        title: i18next.t("lang_fam", {ns: "census_lang"})
      }
    };

    fams = Object.keys(families);
    for (f = 0; f < fams.length; f++) {
      fam = fams[f];
      views["+" + fam] = {
        langs: families[fam],
        title: getLangi18n(fam)
      };
    }

    defaultView = views.default;

    if (wb && wb.pageUrlParts && wb.pageUrlParts.params.langs) {
      langs = wb.pageUrlParts.params.langs;
      if (Object.keys(views).indexOf(langs) === -1) {
        langsList = [].concat.apply([], langs.split(",").map(function(lang){
          if (lang.substr(0,1) === "+") {
            lang = lang.substr(1);
            if (Object.keys(categories).indexOf(lang) !== -1)
              return categories[lang];
            if (Object.keys(families).indexOf(lang) !== -1)
              return families[lang];
          } else if (Object.keys(canadaLangData[canadaSgc]).indexOf(lang) !== -1) {
            return [lang];
          }

          return [];
        }));

        if (langsList.length > 0) {
          views[langs] = {
            langs: langsList
          };
          initialView = views[langs];
          $viewsList.append(getOption(langs, i18next.t("custom_view", {ns: "census_lang"})));
        }
      } else {
        initialView = views[langs];
        if ($viewsList.find("[value='" + langs + "']").length === 0) {
          $viewsList.append(getOption(langs, initialView.title || i18next.t("custom_view", {ns: "census_lang"})));
        }
      }
    }
  },
  setView = function(view) {
    currentView = views[view] ?  views[view] : initialView || defaultView;

    showData();
  },
  showData = function() {
    var data = canadaLangData[currentSgcId],
      percentData = percentages[currentSgcId];

    title.text(getSGCText(currentSgcId));

    if (currentView.title) {
      groupTitle.text(currentView.title);
    } else {
      groupTitle.text("");
    }

    settings.data = currentView.langs.map(function(lang) {
      return {
        lang: lang,
        value: data[lang],
        percentages: percentData[lang]
      };
    });

    bubbleChart(chart, settings);
    clearHover();
    showTable();
  },
  showTable = function() {
    var i18nSuffix = "_short",
      headerIds = ["total_speaking", "percent_group", "percent_total"],
      groups = categories,
      filteredOut = groups === categories ? families : categories,
      groupOrder = catOrder,
      getGroup = function(l) {
        return groupPrefix + getLangDef(l)[groups === categories ? "category" : "family"];
      },
      tableData = Object.keys(canadaLangData[currentSgcId]).map(function(lang) {
        var value = canadaLangData[currentSgcId][lang];
        if (value !== undefined) {
          return {
            data: {
              lang: lang,
              value: value,
              percentages: $.extend({}, percentages[currentSgcId][lang])
            }
          };
        }
      })
      .filter(function(l) {
        return Object.keys(filteredOut).indexOf(l.data.lang) === -1;
      })
      .sort(function(a, b) {
        var langA = a.data.lang,
          langB = b.data.lang,
          isGroupA = isGroup(langA),
          isGroupB = isGroup(langB),
          diff, groupDiff;
        if (langA === "total")
          return -1;
        if (langB === "total")
          return 1;

        if (isGroupA && isGroupB)
          return groupOrder.indexOf(langA) - groupOrder.indexOf(langB);

        if (isGroupA || isGroupB) {
          diff = groupOrder.indexOf(isGroupA ? langA : getGroup(langA)) - groupOrder.indexOf(isGroupB ? langB : getGroup(langB));

          if (diff === 0) {
            diff = isGroupA ? -1 : 1;
          }

          return diff;
        }

        groupDiff = groupOrder.indexOf(getGroup(langA)) - groupOrder.indexOf(getGroup(langB));

        if (groupDiff !== 0)
          return groupDiff;

        return b.data.value - a.data.value;

      }),
      updateTable = function() {
        var getId = function() {
            return "t_" + settings.x.getValue.apply(settings, arguments);
          },
          getHeader = function() {
            return getId.apply(settings, arguments) + " " + headerIds[this - 1];
          },
          row = d3.select(this),
          x, cell, getCellHeaders;

        for (x = 0; x < 4; x++) {
          cell = row.select(":nth-child(" + (x + 1) + ")");
          getCellHeaders = getHeader.bind(x);

          switch(x) {
          case 0:
            cell
              .attr("id", getId.bind(settings))
              .attr("headers", function(d) {
                if (!isGroup(d.data.lang) && d.data.lang !== "total") {
                  return getLangDef(d.data.lang).category;
                }
              })
              .text(function(d){
                if (d.data.lang !== "total") {
                  return settings.x.getText.call(settings, d, null, null, false);
                }
                return i18next.t("total", {ns: "census_lang"});
              });
            break;
          case 1:
            cell
              .attr("header", getCellHeaders)
              .text(settings.y.getText.bind(settings));
            break;
          default:
            cell
              .attr("header", getCellHeaders)
              .text(function(d) {
                return x === 2 ? settings.y.getPercentageText.call(settings, d, "category") : settings.y.getPercentageText.call(settings, d, "total");
              });
          }
        }
      },
      isGroupRow = function(d) {
        return d.data.lang === "total" || isGroup(d.data.lang);
      },
      body = table.select("tbody"),
      header, dataRows, x;

    if (table.select("thead").empty()) {
      header = table.append("thead")
        .append("tr");

      header.append("td");
      for (x = 0; x < headerIds.length; x++) {
        header.append("th")
          .attr("id", headerIds[x])
          .text(i18next.t(headerIds[x] + i18nSuffix, {ns: "census_lang"}));
      }

      body = table.append("tbody");
    }

    dataRows = body.selectAll("tr")
      .data(tableData);

    dataRows
      .enter()
      .append("tr")
        .classed("langgroup", isGroupRow)
        .each(function() {
          var row = d3.select(this);
          row.append("th");
          row.append("td");
          row.append("td");
          row.append("td");
        })
        .each(updateTable);


    dataRows
      .classed("langgroup", isGroupRow)
      .each(updateTable);

    dataRows
      .exit()
      .remove();
  },
  uiHandler = function(event) {
    var value, $sgc;

    switch (event.target.id) {
    case "sgc_list":
      value = event.target.value.replace("'", "\\'");
      if (value === "") {
        currentSgcId = canadaSgc;
      } else {
        $sgc = $("option[value='" + value + "']");
        if ($sgc.length !== 0) {
          currentSgcId = $sgc.attr("data-id");
        }
      }
      showData();
      break;
    case "view_list":
      setView(event.target.value);
    }
  },
  hoverClickHandler = function(e) {
    var d = e.currentTarget.__data__,
      selection, view, totalPercentage, categoryPercentage, langDef, textPart;

    if (e.type === "click" ) {
      selection = d3.select(e.currentTarget);
      if (selection.classed("category") || selection.classed("family")) {
        view = "+" + selection.attr("id");
        $viewsList.val(view);
        setView(view);
      }
    } else {
      totalPercentage = settings.y.getPercentageText.call(settings, d, "total");
      categoryPercentage = settings.y.getPercentageText.call(settings, d, "category");
      hoverText.select(".hover_lang")
        .text(settings.x.getText.call(settings, d, null, null, false));

      hoverText.select(".hover_value")
        .text(i18next.t("total_speaking", {
          ns: "census_lang",
          lang: settings.x.getText.call(settings, d),
          sgc: i18next.t("sgc_" + currentSgcId, {ns: "sgc"}),
          total: settings.y.getText.call(settings, d)
        }));

      hoverText.select(".hover_percenttotal")
        .text(i18next.t("percent_total", {
          ns: "census_lang",
          sgc: i18next.t("sgc_" + currentSgcId, {ns: "sgc"}),
          percent: totalPercentage
        }));

      textPart = hoverText.select(".hover_percentcat");
      if (categoryPercentage) {
        langDef = getLangDef(d.data.lang);
        textPart.text(i18next.t("percent_group", {
          ns: "census_lang",
          sgc: i18next.t("sgc_" + currentSgcId, {ns: "sgc"}),
          group: i18next.t(langDef.category, {ns: "category"}).toLowerCase(),
          percent: categoryPercentage
        }));
      } else {
        textPart.text("");
      }
    }
  },
  clearHover = function() {
    hoverText.selectAll("tspan").text("");
  },
  percentages = {},
  langDataIndex = [],
  views, defaultView, initialView, currentView, uiTimeout, langData, canadaLangData, sgcData;


i18n.load([sgcI18nRoot, langI18nRoot, rootI18nRoot], function() {
  d3.queue()
    .defer(d3.json, sgcDataUrl)
    .defer(d3.json, langDataUrl)
    .defer(d3.json, canadaLangDataUrl)
    .await(function(error, sgcs, langs, canadaLangs) {
      var $list = $("#sgc_list"),
        geos, g, id, text,
        getSGCId = function(d, data) {
          if (Object.values) {
            return Object.keys(data)[Object.values(data).indexOf(d)];
          } else {
            return Object.keys(data).filter(function(key) {
              return data[key] === d;
            }).pop();
          }
        };

      sgcData = sgcs;
      langData = langs.langs;

      categorizeLanguages();
      canadaLangData = processLangData(canadaLangs);

      // TODO: Remove this horrible patch when d3 bug is fixed
      if (canadaLangData["320"]) {
        var horribleSolution = .00001;
        canadaLangData["001"].iku += horribleSolution;
        canadaLangData["320"].mic += horribleSolution;
        canadaLangData["329"].mic += horribleSolution;
        canadaLangData["444"].atj += horribleSolution;
      }

      createViews();
      setView();

      groupTitle
        .attr("x", (settings.width || 600) / 2)
        .attr("dy", "1em")
        .attr("text-anchor", "middle")
        .attr("aria-hidden", "true");

      hoverText
        .append("tspan")
          .attr("dy", "1.5em")
          .attr("class", "hover_lang");

      hoverText
        .append("tspan")
          .attr("x", 0)
          .attr("dy", "1.5em")
          .attr("class", "hover_value");

      hoverText
        .append("tspan")
          .attr("x", 0)
          .attr("dy", "1.5em")
          .attr("class", "hover_percenttotal");

      hoverText
        .append("tspan")
          .attr("x", 0)
          .attr("dy", "1.5em")
          .attr("class", "hover_percentcat");

      geos = Object.keys(canadaLangData).sort(function(a, b) {
        if (a.length !== b.length) {
          return a.length - b.length;
        }
        return parseInt(a, 10) - parseInt(b, 10);
      });

      for (g =0; g < geos.length; g++) {
        id = geos[g];
        text = getSGCText(getSGCId(canadaLangs[id], canadaLangs));
        $list.append("<option value=\"" + text + "\" data-id=\"" + id + "\">" + text + "</option>");
      }

      $(document).on("input change", function(event) {
        clearTimeout(uiTimeout);
        uiTimeout = setTimeout(function() {
          uiHandler(event);
        }, 100);
      });

      $(document).on("mouseenter click", ".bubble", hoverClickHandler);
    });
});
