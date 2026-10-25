'use strict';

const { segmentEntries } = require('./segmentar_texto');

function buildPatakiEntries(index, sources) {
  let catalogOrder = 0;
  const entries = [];
  for (const [cell, items] of Object.entries(index.pk.cells)) {
    for (const item of items) {
      entries.push({
        id: `pk-${catalogOrder}`,
        cell,
        source: item[4] ? 'D' : 'N',
        title: index.pk.labs[item[0]],
        number: item[1],
        start: item[2],
        end: item[3],
        catalogOrder: catalogOrder++
      });
    }
  }
  return segmentEntries(entries, sources);
}

module.exports = { buildPatakiEntries };
