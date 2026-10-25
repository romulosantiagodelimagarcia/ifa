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
    const match = findTitle(entry.source, entry.start, entry.matchTitle || entry.title);
    entry.titleMatches = match.matchCount;
    entry.status = match.matchCount === 1 ? 'matched' : 'needs-review';
    if (entry.status !== 'matched') {
      entry.reviewReason = match.matchCount ? 'title-repeated' : 'title-not-found';
    }
    entry.startOffset = match.matchCount ? match.start : 0;
    entry.titleEndOffset = match.matchCount ? match.end : 0;
    const key = entry.groupKey || `${entry.source}:${entry.cell}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }

  for (const group of groups.values()) {
    group.sort((a, b) =>
      a.start - b.start || a.startOffset - b.startOffset || a.catalogOrder - b.catalogOrder);
    for (let i = 0; i < group.length - 1; i++) {
      const current = group[i];
      const next = group[i + 1];
      if (current.titleMatches > 0 && next.titleMatches > 0 &&
          current.start === next.start &&
          next.startOffset < current.titleEndOffset) {
        current.status = 'needs-review';
        current.reviewReason = 'title-overlap';
        next.status = 'needs-review';
        next.reviewReason = 'title-overlap';
      }
    }
    for (let i = 0; i < group.length; i++) {
      const entry = group[i];
      const next = group.slice(i + 1).find(candidate =>
        candidate.titleMatches > 0 &&
        (candidate.start > entry.start ||
          (candidate.start === entry.start &&
            candidate.startOffset >= entry.titleEndOffset)));
      const missingBoundary = group.slice(i + 1).find(candidate =>
        candidate.titleMatches === 0 &&
        candidate.start > entry.start &&
        candidate.start <= entry.end);
      if (missingBoundary && entry.status === 'matched') {
        entry.status = 'needs-review';
        entry.reviewReason = 'next-title-not-found';
      }
      const pages = [];
      let finalPage = next && next.start <= entry.end ? next.start : entry.end;
      if (missingBoundary) finalPage = Math.min(finalPage, missingBoundary.start);
      for (let pageNumber = entry.start; pageNumber <= finalPage; pageNumber++) {
        const text = sources[entry.source].textPages[pageNumber];
        if (typeof text !== 'string') continue;
        const start = pageNumber === entry.start ? entry.startOffset : 0;
        const end = missingBoundary && missingBoundary.start === pageNumber &&
          missingBoundary.start > entry.start
          ? 0
          : next && next.start === pageNumber && next.start <= finalPage
            ? next.startOffset
            : text.length;
        const excerpt = text.slice(start, Math.max(start, end)).trim();
        if (excerpt) pages.push({ page: pageNumber, text: excerpt });
      }
      entry.pages = pages;
      delete entry.startOffset;
      delete entry.titleEndOffset;
      delete entry.catalogOrder;
      delete entry.matchTitle;
      delete entry.groupKey;
    }
  }
  return entries;
}

module.exports = { segmentEntries };
