'use strict';

function normalize(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function createPageMatcher(sources) {
  const cache = new Map();

  function getNormalizedPage(source, pageNumber) {
    const key = `${source}:${pageNumber}`;
    if (cache.has(key)) return cache.get(key);
    const text = sources[source]?.textPages?.[pageNumber];
    if (typeof text !== 'string') return null;

    const normalized = [];
    const starts = [];
    const ends = [];
    for (let offset = 0; offset < text.length;) {
      const codePoint = text.codePointAt(offset);
      const character = String.fromCodePoint(codePoint);
      const transformed = character.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
      for (const letter of transformed) {
        normalized.push(letter);
        starts.push(offset);
        ends.push(offset + character.length);
      }
      offset += character.length;
    }
    const page = {
      text,
      normalized: normalized.join(''),
      starts: Uint32Array.from(starts),
      ends: Uint32Array.from(ends)
    };
    cache.set(key, page);
    return page;
  }

  return (source, pageNumber, title) => {
    const page = getNormalizedPage(source, pageNumber);
    const needle = normalize(title);
    if (!page || !needle) return { matchCount: 0 };
    const first = page.normalized.indexOf(needle);
    if (first < 0) return { matchCount: 0 };
    let matchCount = 1;
    let next = page.normalized.indexOf(needle, first + needle.length);
    while (next >= 0) {
      matchCount++;
      next = page.normalized.indexOf(needle, next + needle.length);
    }
    return {
      matchCount,
      start: page.starts[first],
      end: page.ends[first + needle.length - 1]
    };
  };
}

function segmentEntries(entries, sources) {
  const findTitle = createPageMatcher(sources);
  const groups = new Map();

  for (const entry of entries) {
    const match = findTitle(entry.source, entry.start, entry.title);
    entry.titleMatches = match.matchCount;
    entry.status = match.matchCount === 1 ? 'matched' : 'needs-review';
    entry.startOffset = match.matchCount ? match.start : 0;
    const key = `${entry.source}:${entry.cell}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }

  for (const group of groups.values()) {
    group.sort((a, b) =>
      a.start - b.start || a.startOffset - b.startOffset || a.catalogOrder - b.catalogOrder);
    for (let i = 0; i < group.length; i++) {
      const entry = group[i];
      const next = group.slice(i + 1).find(candidate =>
        candidate.titleMatches > 0 &&
        (candidate.start > entry.start ||
          (candidate.start === entry.start && candidate.startOffset > entry.startOffset)));
      const pages = [];
      const finalPage = next && next.start <= entry.end ? next.start : entry.end;
      for (let pageNumber = entry.start; pageNumber <= finalPage; pageNumber++) {
        const text = sources[entry.source].textPages[pageNumber];
        if (typeof text !== 'string') continue;
        const start = pageNumber === entry.start ? entry.startOffset : 0;
        const end = next && next.start === pageNumber ? next.startOffset : text.length;
        const excerpt = text.slice(start, Math.max(start, end)).trim();
        if (excerpt) pages.push({ page: pageNumber, text: excerpt });
      }
      entry.pages = pages;
      delete entry.startOffset;
      delete entry.catalogOrder;
    }
  }
  return entries;
}

module.exports = { segmentEntries };
