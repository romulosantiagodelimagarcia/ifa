(() => {
  window.IFA_TRANSCRIPT_READY.then(data => {
    const $ = id => document.getElementById(id);
    const params = new URLSearchParams(location.hash.slice(1));
    const oduSelect = $('odu');
    const oduByCell = new Map(data.odus.map(odu => [odu.cell, odu]));
    const views = {
      'pataki-tab': 'pataki-view',
      'subitem-tab': 'subitem-view',
      'ewe-tab': 'ewe-view',
      'full-tab': 'full-view'
    };

    for (const odu of data.odus) {
      const option = document.createElement('option');
      option.value = odu.cell;
      option.textContent = `${odu.names.N} / ${odu.names.D}`;
      oduSelect.append(option);
      $('work-odu').append(option.cloneNode(true));
    }

    function normalize(value) {
      return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
    }

    function pageLink(source, page, title) {
      const sourceData = data.sources[source];
      const pageNumber = Number(page);
      if (!sourceData || !Number.isSafeInteger(pageNumber) ||
          pageNumber < 1 || pageNumber > sourceData.pages) {
        throw new Error('Fonte ou página inválida para abrir no leitor.');
      }
      const link = document.createElement('a');
      const target = new URL('leitor.html', document.baseURI);
      target.hash = new URLSearchParams({
        d: source,
        p: String(pageNumber),
        t: title
      }).toString();
      link.href = target.href;
      link.textContent = `${sourceData.title} · abrir p. ${pageNumber} no leitor`;
      link.target = 'ifa-leitor';
      return link;
    }

    function renderEntries(container, entries, source, emptyMessage) {
      container.replaceChildren();
      if (!entries.length) {
        const message = document.createElement('p');
        message.className = 'empty';
        message.textContent = emptyMessage;
        container.append(message);
        return;
      }
      for (const entry of entries) {
        const article = document.createElement('article');
        article.className = 'transcript-item';
        const title = document.createElement('h3');
        title.textContent = `${entry.number ? `${entry.number}. ` : ''}${entry.title}`;
        article.append(title);
        const pageRange = entry.start === entry.end
          ? `p. ${entry.start}`
          : `pp. ${entry.start}–${entry.end}`;
        const meta = document.createElement('p');
        meta.className = 'item-meta';
        meta.textContent = [
          entry.category,
          entry.purposes?.length ? entry.purposes.join(' · ') : '',
          pageRange
        ].filter(Boolean).join(' · ');
        article.append(meta, pageLink(source, entry.start, entry.title));
        if (entry.status !== 'matched') {
          const review = document.createElement('p');
          review.className = 'item-review';
          const messages = {
            'title-repeated': 'Título repetido na página; confira o trecho no PDF.',
            'title-not-found': 'Título não localizado automaticamente; confira o trecho no PDF.',
            'title-overlap': 'Títulos indexados se sobrepõem; confira o trecho no PDF.',
            'next-title-not-found': 'O próximo título não foi localizado; limite deste trecho precisa de conferência no PDF.'
          };
          review.textContent = messages[entry.reviewReason] ||
            'Trecho precisa de conferência manual no PDF.';
          article.append(review);
        }
        for (const page of entry.pages) {
          const block = document.createElement('section');
          block.className = 'item-pages';
          if (page.page !== entry.start) {
            const pageLabel = document.createElement('p');
            pageLabel.textContent = `Continuação · p. ${page.page}`;
            block.append(pageLabel);
          }
          const text = document.createElement('pre');
          text.textContent = page.text;
          block.append(text);
          article.append(block);
        }
        container.append(article);
      }
    }

    function renderOdu(cell) {
      const odu = oduByCell.get(cell) || data.odus[0];
      oduSelect.value = odu.cell;
      $('work-odu').value = odu.cell;
      for (const source of ['N', 'D']) {
        const entries = data.entries.patakis.filter(entry =>
          entry.cell === odu.cell && entry.source === source);
        renderEntries(
          $(`${source === 'N' ? 'n' : 'd'}-content`),
          entries,
          source,
          'Nenhum patakí indexado para esta fonte neste odu.'
        );
      }
      $('odu-coverage').textContent =
        'Quando localizado, o trecho começa no título indexado e termina antes do próximo título detectado nesse odu. Itens com aviso precisam de conferência no PDF.';
      history.replaceState(null, '', `#odu=${encodeURIComponent(odu.cell)}`);
    }

    function renderSubitems(cell, query) {
      const odu = oduByCell.get(cell) || data.odus[0];
      $('work-odu').value = odu.cell;
      const needle = normalize(query.trim());
      const matches = data.entries.subitems.filter(entry =>
        entry.cell === odu.cell &&
        (!needle || normalize(`${entry.title} ${entry.category}`).includes(needle)));
      $('subitem-count').textContent = `${matches.length} subitens neste odu`;
      for (const source of ['N', 'D']) {
        renderEntries(
          $(`${source === 'N' ? 'n' : 'd'}-subitems`),
          matches.filter(entry => entry.source === source),
          source,
          'Nenhum subitem indexado para esta fonte neste odu.'
        );
      }
    }

    function renderEwe(query) {
      const list = $('ewe-list');
      const needle = normalize(query);
      const matches = data.ewe.rows.filter(row =>
        normalize([row.scientific, row.family, ...row.yoruba].join(' ')).includes(needle));
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
          const textContent = data.sources.V.textPages[pageNumber];
          if (!textContent) continue;
          const block = document.createElement('section');
          block.className = 'ewe-page';
          block.append(pageLink('V', pageNumber, row.scientific));
          const text = document.createElement('pre');
          text.textContent = textContent;
          block.append(text);
          card.append(block);
        }
        list.append(card);
      }
    }

    function renderFullPage() {
      const source = $('full-source').value;
      const sourceData = data.sources[source];
      const pages = sourceData.textPages;
      const total = sourceData.pages;
      const available = Object.keys(pages).length;
      const pageInput = $('full-page-number');
      const requested = Number.parseInt(pageInput.value, 10);
      const pageNumber = Math.max(1, Math.min(total, Number.isInteger(requested) ? requested : 1));
      pageInput.max = total;
      pageInput.value = pageNumber;
      $('full-coverage').textContent =
        `${sourceData.title} · ${available.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')} páginas transcritas`;
      $('full-page-title').textContent = `${sourceData.title} · página ${pageNumber}`;
      const previousLink = $('full-page-link');
      const link = pageLink(source, pageNumber, sourceData.title);
      link.id = 'full-page-link';
      previousLink.replaceWith(link);
      $('full-page-text').textContent = pages[pageNumber] || 'Não há texto reconhecido nesta página.';
    }

    function searchFullText(query) {
      const results = $('search-results');
      const needle = normalize(query.trim());
      results.replaceChildren();
      if (!needle) {
        $('search-count').textContent = 'Digite um termo para pesquisar todas as páginas da obra selecionada.';
        return;
      }
      const source = $('full-source').value;
      const pages = data.sources[source].textPages;
      let matchCount = 0;
      for (const [pageNumber, text] of Object.entries(pages)) {
        const position = normalize(text).indexOf(needle);
        if (position < 0) continue;
        matchCount++;
        if (matchCount > 100) continue;
        const result = document.createElement('article');
        result.className = 'search-result';
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = `Página ${pageNumber}`;
        button.addEventListener('click', () => {
          $('full-page-number').value = pageNumber;
          renderFullPage();
          $('full-page-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        const excerpt = document.createElement('p');
        const start = Math.max(0, position - 90);
        excerpt.textContent = `${start ? '…' : ''}${text.slice(start, position + needle.length + 150)}${position + needle.length + 150 < text.length ? '…' : ''}`;
        result.append(button, excerpt);
        results.append(result);
      }
      $('search-count').textContent = matchCount
        ? `${matchCount.toLocaleString('pt-BR')} páginas encontradas${matchCount > 100 ? ' · exibindo as primeiras 100' : ''}`
        : 'Nenhuma página encontrada.';
    }

    for (const [tabId, viewId] of Object.entries(views)) {
      $(tabId).addEventListener('click', () => {
        for (const [otherTab, otherView] of Object.entries(views)) {
          $(otherView).hidden = otherView !== viewId;
          $(otherTab).setAttribute('aria-pressed', String(otherView === viewId));
        }
        if (viewId === 'ewe-view') renderEwe($('ewe-search').value);
        if (viewId === 'subitem-view') renderSubitems($('work-odu').value, $('subitem-search').value);
      });
    }

    oduSelect.addEventListener('change', () => renderOdu(oduSelect.value));
    $('work-odu').addEventListener('change', () => renderSubitems($('work-odu').value, $('subitem-search').value));
    $('subitem-search').addEventListener('input', () => renderSubitems($('work-odu').value, $('subitem-search').value));
    $('ewe-search').addEventListener('input', () => renderEwe($('ewe-search').value));
    $('full-source').addEventListener('change', () => {
      $('search-results').replaceChildren();
      $('full-search').value = '';
      searchFullText('');
      renderFullPage();
    });
    $('full-page-number').addEventListener('change', renderFullPage);
    $('previous-page').addEventListener('click', () => {
      $('full-page-number').value = Number($('full-page-number').value) - 1;
      renderFullPage();
    });
    $('next-page').addEventListener('click', () => {
      $('full-page-number').value = Number($('full-page-number').value) + 1;
      renderFullPage();
    });
    let searchTimer;
    $('full-search').addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => searchFullText($('full-search').value), 150);
    });

    const pageCoverage = ['N', 'D', 'V'].map(source => {
      const sourceData = data.sources[source];
      return `${sourceData.title}: ${Object.keys(sourceData.textPages).length.toLocaleString('pt-BR')}/${sourceData.pages.toLocaleString('pt-BR')} páginas`;
    });
    const titleCoverage = ['patakis', 'subitems'].map(kind => {
      const entries = data.entries[kind];
      const matched = entries.filter(entry => entry.status === 'matched').length;
      const label = kind === 'patakis' ? 'patakís' : 'subitens';
      return `${matched.toLocaleString('pt-BR')}/${entries.length.toLocaleString('pt-BR')} ${label} com título localizado`;
    });
    $('transcript-coverage').textContent = [...pageCoverage, ...titleCoverage].join(' · ');
    for (const source of ['N', 'D']) {
      const sourceData = data.sources[source];
      $(`${source === 'N' ? 'n' : 'd'}-coverage`).textContent =
        `${Object.keys(sourceData.textPages).length.toLocaleString('pt-BR')} de ${sourceData.pages.toLocaleString('pt-BR')} páginas extraídas`;
    }
    renderOdu(oduByCell.has(params.get('odu')) ? params.get('odu') : data.odus[0].cell);
    searchFullText('');
    renderFullPage();
  }).catch(error => {
    const message = document.createElement('p');
    message.className = 'empty';
    message.textContent = `Não foi possível carregar as transcrições: ${error.message}`;
    document.querySelector('main').append(message);
  });
})();
