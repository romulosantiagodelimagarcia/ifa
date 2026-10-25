(() => {
  const data = window.IFA_TRANSCRIPT;
  if (!data) return;
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.hash.slice(1));
  const oduSelect = $('odu');
  const oduByCell = new Map(data.odus.map(odu => [odu.cell, odu]));

  for (const odu of data.odus) {
    const option = document.createElement('option');
    option.value = odu.cell;
    option.textContent = `${odu.names.N} / ${odu.names.D}`;
    oduSelect.append(option);
  }

  function pageLink(source, page, title) {
    const link = document.createElement('a');
    link.href = `leitor.html#d=${source}&p=${page}&t=${encodeURIComponent(title)}`;
    link.textContent = `${data.sources[source].title} · abrir p. ${page} no leitor`;
    link.target = 'ifa-leitor';
    return link;
  }

  function renderPages(container, source, pages, title) {
    container.replaceChildren();
    if (!pages?.length) {
      const message = document.createElement('p');
      message.className = 'empty';
      message.textContent = 'Nenhum trecho indexado para esta fonte.';
      container.append(message);
      return;
    }
    for (const page of pages) {
      const section = document.createElement('section');
      section.className = 'page';
      section.append(pageLink(source, page.page, title));
      const text = document.createElement('pre');
      text.textContent = page.text;
      section.append(text);
      container.append(section);
    }
  }

  function renderOdu(cell) {
    const odu = oduByCell.get(cell) || data.odus[0];
    oduSelect.value = odu.cell;
    renderPages($('n-content'), 'N', odu.sources.N?.pages, odu.names.N);
    renderPages($('d-content'), 'D', odu.sources.D?.pages, odu.names.D);
    history.replaceState(null, '', `#odu=${encodeURIComponent(odu.cell)}`);
  }

  function renderEwe(query) {
    const list = $('ewe-list');
    const needle = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
    const matches = data.ewe.rows.filter(row =>
      [row.scientific, row.family, ...row.yoruba].join(' ')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().includes(needle));
    $('ewe-count').textContent = `${matches.length} espécies`;
    list.replaceChildren();
    for (const row of matches) {
      const card = document.createElement('article');
      card.className = 'ewe-card';
      const title = document.createElement('h3');
      title.textContent = row.scientific;
      card.append(title);
      const details = document.createElement('p');
      details.textContent = `${row.family}${row.yoruba.length ? ` · ${row.yoruba.join(', ')}` : ''}`;
      card.append(details);
      for (const pageNumber of row.pages) {
        const page = data.ewe.pages[pageNumber];
        if (!page) continue;
        const block = document.createElement('section');
        block.className = 'ewe-page';
        block.append(pageLink('V', pageNumber, row.scientific));
        const text = document.createElement('pre');
        text.textContent = page;
        block.append(text);
        card.append(block);
      }
      list.append(card);
    }
  }

  $('pataki-tab').addEventListener('click', () => {
    $('pataki-view').hidden = false;
    $('ewe-view').hidden = true;
    $('pataki-tab').setAttribute('aria-pressed', 'true');
    $('ewe-tab').setAttribute('aria-pressed', 'false');
  });
  $('ewe-tab').addEventListener('click', () => {
    $('pataki-view').hidden = true;
    $('ewe-view').hidden = false;
    $('pataki-tab').setAttribute('aria-pressed', 'false');
    $('ewe-tab').setAttribute('aria-pressed', 'true');
    renderEwe($('ewe-search').value);
  });
  oduSelect.addEventListener('change', () => renderOdu(oduSelect.value));
  $('ewe-search').addEventListener('input', () => renderEwe($('ewe-search').value));
  renderOdu(oduByCell.has(params.get('odu')) ? params.get('odu') : data.odus[0].cell);
})();
