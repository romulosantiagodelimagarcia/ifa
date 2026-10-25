'use strict';

const { segmentEntries } = require('./segmentar_texto');

function normalize(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function buildOrishaEntries(index, sources, itemEntries) {
  const byOduName = new Map();
  for (const odu of index.odus) {
    byOduName.set(normalize(odu.nav), odu.c);
    byOduName.set(normalize(odu.del), odu.c);
  }

  const indexedEntries = new Map();
  for (const entry of itemEntries) {
    const key = `${entry.source}:${entry.start}:${normalize(entry.title)}`;
    if (!indexedEntries.has(key)) indexedEntries.set(key, entry.id);
  }

  const entities = [];
  const naceEntries = [];
  for (const [key, orisha] of Object.entries(index.orishas)) {
    const groups = [];
    for (const group of orisha.groups) {
      const items = group.items.map(item => ({
        title: item.t,
        source: item.s,
        pages: item.p,
        entryIds: item.p.map(page =>
          indexedEntries.get(`${item.s}:${page}:${normalize(item.t)}`) || null)
      }));
      if (items.length) groups.push({ cell: group.c, items });
    }

    for (const item of orisha.nace || []) {
      const cell = byOduName.get(normalize(item.odu));
      const title = item.t.replace(/^\d+\.-\s*/, '');
      naceEntries.push({
        id: `orisha-${naceEntries.length}`,
        source: 'N',
        cell: cell || '',
        groupKey: `orisha-nace:${cell || item.odu}`,
        title,
        indexedTitle: item.t,
        entity: key,
        entityLabel: orisha.label,
        start: item.p,
        end: item.p,
        category: 'Nasce neste odu'
      });
    }

    entities.push({
      key,
      label: orisha.label,
      total: orisha.total,
      groups,
      naceIds: naceEntries
        .filter(entry => entry.entity === key)
        .map(entry => entry.id)
    });
  }

  return {
    entities,
    nace: segmentEntries(naceEntries, sources)
  };
}

module.exports = { buildOrishaEntries };
