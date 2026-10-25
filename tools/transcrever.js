#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const pdfjs = require('../vendor/pdfjs/pdf.min.js');

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'fonte', 'ifa-indice-completo-final.html');
const OUTPUT = path.join(ROOT, 'assets', 'transcricoes.json.gz');
const STATE_DIR = path.join(__dirname, '.transcricao-state');
const SESSION_FILE = path.join(STATE_DIR, 'session.json');
const LOCK_DIR = path.join(STATE_DIR, 'lock');
const DOCS = {
  N: {
    file: 'pdfcoffee.com_coleccion-de-ifa-de-roberto-naveira-pdf-free 2.pdf',
    title: 'Naveira',
    pageKey: 'navp',
    nameKey: 'nav'
  },
  D: {
    file: 'tratado de ifa los 256 oddun 2.pdf',
    title: 'Delgado',
    pageKey: 'delp',
    nameKey: 'del'
  },
  V: {
    file: 'pdfcoffee.com_ewe-pierre-vergerpdf-pdf-free.pdf',
    title: 'Verger',
    pageKey: null,
    nameKey: null
  }
};

pdfjs.GlobalWorkerOptions.workerSrc = path.join(ROOT, 'vendor', 'pdfjs', 'pdf.worker.min.js');

function normalize(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function getIndex() {
  const html = fs.readFileSync(INPUT, 'utf8');
  const match = html.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error(`Bloco de dados não encontrado em ${INPUT}`);
  return JSON.parse(match[1]);
}

async function loadPdf(code, metadata) {
  const file = path.join(ROOT, metadata.file);
  if (!fs.existsSync(file)) throw new Error(`PDF não encontrado: ${file}`);
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(fs.readFileSync(file)),
    isEvalSupported: false,
    standardFontDataUrl: path.join(ROOT, 'vendor', 'pdfjs', 'standard_fonts') + path.sep
  }).promise;
  if (code !== 'V') {
    const expected = code === 'N' ? 3118 : 3089;
    if (doc.numPages !== expected) {
      await doc.destroy();
      throw new Error(`${metadata.title}: esperado ${expected} páginas; recebido ${doc.numPages}`);
    }
  }
  return doc;
}

async function getPageText(doc, pageNumber) {
  const page = await doc.getPage(pageNumber);
  const content = await page.getTextContent();
  const text = content.items.map(item => item.str + (item.hasEOL ? '\n' : ' '))
    .join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  page.cleanup();
  if (!text) throw new Error(`Página ${pageNumber} sem camada de texto reconhecível`);
  return text;
}

function saveSession(session) {
  session.updatedAt = new Date().toISOString();
  const temporary = `${SESSION_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(session));
  fs.renameSync(temporary, SESSION_FILE);
}

function loadPageCheckpoint(code) {
  const file = path.join(STATE_DIR, `pages-${code}.jsonl`);
  const pages = new Map();
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line) continue;
      const record = JSON.parse(line);
      pages.set(record.page, record.text);
    }
  }
  return { file, pages };
}

async function main() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  try {
    fs.mkdirSync(LOCK_DIR);
  } catch {
    throw new Error(`Já existe uma sessão ativa em ${path.relative(ROOT, LOCK_DIR)}; ` +
      'aguarde ou confira o processo antes de remover o lock.');
  }
  fs.writeFileSync(path.join(LOCK_DIR, 'owner.json'), JSON.stringify({
    pid: process.pid,
    sessionId: crypto.randomUUID(),
    startedAt: new Date().toISOString()
  }));

  try {
  const index = getIndex();
  const session = fs.existsSync(SESSION_FILE)
    ? JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'))
    : { sessionId: crypto.randomUUID(), sources: {} };
  session.sources ??= {};
  const oduPages = {};
  for (const [code, metadata] of Object.entries(DOCS)) {
    if (code === 'V') continue;
    const seen = new Set();
    for (const odu of index.odus) {
      const page = odu[metadata.pageKey];
      if (!Number.isInteger(page) || page < 1 || seen.has(page)) {
        throw new Error(`${metadata.title}: página inválida ou repetida no índice: ${page}`);
      }
      seen.add(page);
      oduPages[code] ??= [];
      oduPages[code].push({ cell: odu.c, page, title: odu[metadata.nameKey] });
    }
    oduPages[code].sort((a, b) => a.page - b.page);
    for (let i = 0; i < oduPages[code].length; i++) {
      const current = oduPages[code][i];
      const next = oduPages[code][i + 1];
      current.end = next ? next.page - 1 : code === 'N' ? 3118 : 3089;
      if (current.end < current.page) {
        throw new Error(`${metadata.title}: início de seção fora de ordem na p. ${current.page}`);
      }
    }
  }

  const ewePages = new Set([561, 562, 563, 564, 565, 566, 567, 568, 569, 570, 571,
    572, 573, 574, 575, 576, 577, 578, 579, 580, 581, 582, 583, 584, 585, 586,
    587, 588, 589, 590, 591, 592, 593, 594, 595, 596, 597, 598, 599, 600, 601,
    602, 603, 604, 605, 606, 607, 608, 609, 610, 611, 612, 613, 614, 615, 616,
    617, 618]);
  for (const row of index.ewe.rows) for (const page of row[2]) ewePages.add(page);

  const result = {
    version: 1,
    sources: {},
    odus: index.odus.map(odu => ({
      cell: odu.c,
      names: { N: odu.nav, D: odu.del },
      sources: {}
    })),
    ewe: {
      rows: index.ewe.rows,
      pages: {}
    }
  };
  const byCell = new Map(result.odus.map(odu => [odu.cell, odu]));

  for (const [code, metadata] of Object.entries(DOCS)) {
    const doc = await loadPdf(code, metadata);
    result.sources[code] = { title: metadata.title, pages: doc.numPages, file: metadata.file };
    const checkpoint = loadPageCheckpoint(code);
    const sourceSession = session.sources[code] ??= { status: 'pending', pagesDone: 0 };
    sourceSession.status = 'running';
    sourceSession.totalPages = code === 'V' ? ewePages.size :
      oduPages[code].reduce((total, section) => total + section.end - section.page + 1, 0);
    sourceSession.pagesDone = checkpoint.pages.size;
    saveSession(session);
    const wantedPages = new Set();
    if (code === 'V') {
      if (doc.numPages !== 618) throw new Error(`Verger: esperado 618 páginas; recebido ${doc.numPages}`);
      for (const page of ewePages) {
        if (!Number.isInteger(page) || page < 1 || page > doc.numPages) {
          throw new Error(`Verger: referência de página inválida: ${page}`);
        }
        wantedPages.add(page);
      }
    } else {
      for (const section of oduPages[code]) {
        for (let page = section.page; page <= section.end; page++) wantedPages.add(page);
      }
      for (const section of oduPages[code]) {
        const text = await getPageText(doc, section.page);
        if (!normalize(text).includes(normalize(section.title))) {
          throw new Error(`${metadata.title}: odu ${section.title} não conferido na página ${section.page}`);
        }
      }
      for (const section of oduPages[code]) {
        byCell.get(section.cell).sources[code] = {
          start: section.page,
          end: section.end,
          pages: []
        };
      }
    }

    const pageTexts = {};
    for (const page of [...wantedPages].sort((a, b) => a - b)) {
      let text = checkpoint.pages.get(page);
      if (!text) {
        text = await getPageText(doc, page);
        fs.appendFileSync(checkpoint.file, JSON.stringify({ page, text }) + '\n');
        checkpoint.pages.set(page, text);
        sourceSession.pagesDone = checkpoint.pages.size;
        sourceSession.checkpointPage = page;
        saveSession(session);
      }
      pageTexts[page] = text;
      if (code !== 'V') {
        const section = oduPages[code].find(item => page >= item.page && page <= item.end);
        byCell.get(section.cell).sources[code].pages.push({ page, text: pageTexts[page] });
      }
    }
    if (code === 'V') {
      result.ewe.pages = pageTexts;
      result.ewe.rows = index.ewe.rows.map(row => ({
        scientific: row[0],
        family: row[1],
        pages: row[2],
        yoruba: row[3],
        purposes: row[4],
        details: row[5]
      }));
    }
    await doc.destroy();
    sourceSession.status = 'completed';
    sourceSession.pagesDone = wantedPages.size;
    sourceSession.completedAt = new Date().toISOString();
    saveSession(session);
    console.log(`${metadata.title}: ${wantedPages.size} páginas extraídas`);
  }

  const output = zlib.gzipSync(JSON.stringify(result), { level: 9 });
  fs.writeFileSync(OUTPUT, output);
  console.log(`${path.relative(ROOT, OUTPUT)}: ${output.byteLength} bytes compactados`);
  session.status = 'completed';
  saveSession(session);
  } finally {
    fs.rmSync(LOCK_DIR, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
