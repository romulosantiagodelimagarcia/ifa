'use strict';

const { segmentEntries } = require('./segmentar_texto');

function buildSubitemEntries(index, sources) {
  let catalogOrder = 0;
  const entries = [];
  for (const [cell, items] of Object.entries(index.works.cells)) {
    for (const item of items) {
      entries.push({
        id: `work-${catalogOrder}`,
        cell,
        source: item[2] ? 'D' : 'N',
        title: index.works.labs[item[1]],
        category: index.works.types[item[0]],
        purposes: item[4].map(purpose => index.works.purps[purpose]),
        start: item[3],
        end: item[3],
        catalogOrder: catalogOrder++
      });
    }
  }
  return segmentEntries(entries, sources);
}

module.exports = { buildSubitemEntries };
