'use strict';

const { segmentEntries } = require('./segmentar_texto');

function buildEweEntries(index, sources) {
  const plants = [];
  const charms = [];
  let order = 0;

  for (const [scientific, family, pages, yoruba, purposes, details] of index.ewe.rows) {
    for (const page of pages) {
      plants.push({
        id: `ewe-plant-${order++}`,
        source: 'V',
        title: scientific,
        scientific,
        family,
        yoruba,
        purposes: purposes.map(purpose => index.ewe.val[purpose]),
        start: page,
        end: page,
        groupKey: `ewe-plant:${page}`
      });
    }

    for (const [name, meaning, , page] of details) {
      const title = name || `${scientific} · ${meaning || 'encantamento'}`;
      charms.push({
        id: `ewe-charm-${order++}`,
        source: 'V',
        title,
        matchTitle: name || scientific,
        scientific,
        family,
        meaning,
        start: page,
        end: page,
        groupKey: `ewe-charm:${page}`
      });
    }
  }

  return {
    plants: segmentEntries(plants, sources),
    charms: segmentEntries(charms, sources)
  };
}

module.exports = { buildEweEntries };
