# Índice de Ifá — versão para navegador

Índice remissivo dos patakís, obras, adimús e ewes nos 256 odus, com **cada título e cada número de
página funcionando como link que abre o PDF exatamente naquela página**:

- *Colección de Ifá* — Roberto Naveira (`N`)
- *Tratado Enciclopédico de Caminos de Ifá* — Yamel Delgado (`D`)
- *Ewé — o uso das plantas na sociedade iorubá* — Pierre Verger (ewes e encantamentos)

O site é estático (HTML + JS, sem servidor e sem build) e funciona sem internet. Os dados vêm, sem
alteração, do índice original em `fonte/ifa-indice-completo-final.html`.

## Transcrições

`transcricao.html` apresenta por odu o texto extraído em listas independentes de Naveira e Delgado,
sem presumir que histórias em páginas semelhantes sejam correspondentes. A aba Ewé mostra as páginas
do Verger indexadas por espécie. Cada página transcrita tem um link para o leitor PDF. A separação
automática estabelece limites de odu e preserva a paginação; ela não determina com segurança o
começo e o fim de cada narrativa individual, que ainda exigem conferência antes de uma publicação
como transcrições separadas por patakí.

Para regenerar a transcrição a partir dos PDFs reconhecíveis na raiz:

```
node tools/transcrever.js
```

O extrator valida os 256 pontos de início de odu de cada tratado, separa o texto até o próximo odu e
grava checkpoints locais para retomar uma execução interrompida. O estado temporário fica em
`tools/.transcricao-state/` e não é publicado. Os nomes científicos, famílias, páginas e nomes yorùbá
de Ewé vêm do índice; os trechos do Verger são extraídos das páginas mapeadas. O resultado é
`assets/transcricoes.json.gz`; o navegador o descompacta ao abrir `transcricao.html`.

Como a transcrição é carregada via `fetch`, abra o site por HTTP, não diretamente por `file://`.
Para testar localmente, use `python3 -m http.server 8000` e visite
<http://localhost:8000/transcricao.html>.

### Revisão dos tons yorùbá

Depois de gerar `assets/transcricoes.json.gz`, execute `python3 tools/restaurar_tons.py`. O worker cria
`assets/yoruba-tonos-revisao.json` com sugestões apoiadas pelos nomes yorùbá indexados no Verger.
Como uma mesma palavra sem marcas pode ter leituras diferentes, sugestões não são aplicadas sem
revisão. Inclua apenas substituições confirmadas em `tools/yoruba-tonos-aprovados.json` e execute
`python3 tools/restaurar_tons.py --apply-approved` para aplicá-las.

## 1. Colocar os PDFs

Copie os três PDFs para a pasta `pdf/` com estes nomes:

| Arquivo            | Obra                | Páginas |
|--------------------|---------------------|---------|
| `pdf/naveira.pdf`  | Naveira             | 3.118   |
| `pdf/delgado.pdf`  | Delgado             | 3.089   |
| `pdf/verger.pdf`   | Verger              | 618     |

A pasta `pdf/` está no `.gitignore`: **os PDFs nunca sobem para o GitHub**. As páginas do índice são a
numeração do arquivo PDF (página 1 = primeira folha do arquivo), não a impressa no livro.

## 2. Usar offline

**Mais simples (computador):** dê dois cliques no `index.html`. Os links abrem
`pdf/<arquivo>.pdf#page=N` no visualizador de PDF do próprio navegador (Chrome, Edge ou Firefox).

**Com o leitor embutido** (destaca o título do patakí na página e funciona no celular): sirva a pasta
por http. Com Python instalado, dentro da pasta do projeto:

```
python -m http.server 8000
```

e abra <http://localhost:8000>. Para abrir no celular na mesma rede Wi-Fi, use
`python -m http.server 8000 --bind 0.0.0.0` e acesse `http://IP-DO-COMPUTADOR:8000` no celular.

No topo do índice dá para escolher onde as páginas abrem: **Automático** (PDF do navegador quando
aberto direto do disco, leitor embutido quando servido por http), **Leitor embutido** ou **PDF do
navegador**. A escolha fica salva no navegador.

### O leitor embutido (`leitor.html`)

- Abre na página do link e destaca o título do patakí, a espécie ou o encantamento.
- Rolagem contínua por todo o PDF, campo de página, zoom (− / +, teclas ← → + −).
- Todos os links usam a mesma aba do leitor, em vez de abrir uma aba nova a cada clique.
- Se o PDF não estiver na pasta `pdf/` (por exemplo no celular, ou num GitHub Pages sem os PDFs), o
  leitor pede o arquivo **uma vez**: pode escolher os três de uma vez, ele reconhece cada um pelo
  número de páginas. Os arquivos ficam guardados **só naquele navegador** (IndexedDB) e não são
  enviados a lugar nenhum. Menu `⋯` → *Arquivos PDF…* para ver ou esquecer o que está guardado.
- Usa [PDF.js](https://mozilla.github.io/pdf.js/) 3.11 incluído em `vendor/pdfjs/` (funciona sem
  internet e também via `file://`).

## 3. GitHub Pages (quando quiser publicar)

Nada está publicado. É possível publicar a partir deste repositório privado com um plano que ofereça
GitHub Pages para repositórios privados. Para ativar:
*Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`*.

Antes, saiba que:

- No GitHub Free, o repositório precisa ser **público**; planos elegíveis permitem manter o repositório
  privado. Isso protege o código-fonte, mas não o site: o Pages é público por padrão. Restringir o
  acesso ao site exige Enterprise Cloud e um repositório de organização. A tag `noindex` só pede aos
  buscadores para não indexar. Consulte [os limites de plano](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
  e [o controle de acesso](https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site).
- Antes de ativar, confira tudo que está versionado: o Pages publica os arquivos da raiz, inclusive
  PDFs que estejam nela. A pasta `pdf/` é ignorada pelo Git, mas isso não se aplica aos PDFs já
  versionados na raiz. Quem abrir o site pode escolher os próprios PDFs no aparelho, e o leitor
  funciona igual.
- A aba **“Meu itá”** traz o seu registro pessoal (odus e datas), que ficaria visível para quem tiver
  o link.
- O arquivo `.nojekyll` já está na raiz, para o Pages servir os arquivos como estão.

## Estrutura

```
index.html                 índice (todas as abas do original)
transcricao.html           transcrições por odu e Ewé
leitor.html                leitor de PDF embutido
assets/app.js              lógica do índice + geração dos links de página
assets/data.js             dados do índice (gerado — não editar à mão)
assets/transcricoes.json.gz texto transcrito comprimido (gerado)
assets/transcricoes.js     carrega e descompacta o texto no navegador
assets/transcricao.js      interface das transcrições
assets/leitor.js|.css      leitor
assets/style.css           estilo do índice
assets/fonts.css, fonts/   IBM Plex Sans/Mono e Fraunces locais (SIL OFL)
vendor/pdfjs/              PDF.js 3.11.174 (Apache-2.0)
fonte/                     índice original (fonte dos dados)
tools/extrair_dados.py     regenera assets/data.js a partir do índice original
tools/transcrever.js       extrai texto dos PDFs por odu e por página do Ewé
tools/restaurar_tons.py    worker de sugestões e aplicação revisada de tons
pdf/                       seus PDFs (fora do git)
```

## Atualizar os dados

Se o índice original for refeito, substitua `fonte/ifa-indice-completo-final.html` e rode:

```
python3 tools/extrair_dados.py
```

## Conferência das páginas

As cerca de 30 mil referências de patakís e obras foram conferidas contra o texto dos três PDFs:
99,8% têm o título exatamente na página indicada, e as que não batem são quase todas títulos com
espaçamento irregular no original. Todas as 1.018 páginas de espécies do Verger conferem. No “nasce
neste odu”, cerca de 1 em cada 6 referências aponta a página vizinha.
