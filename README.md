# Índice de Ifá — versão para navegador

Índice remissivo dos patakís, obras, adimús e ewes nos 256 odus, com **cada título e cada número de
página funcionando como link que abre o PDF exatamente naquela página**:

- *Colección de Ifá* — Roberto Naveira (`N`)
- *Tratado Enciclopédico de Caminos de Ifá* — Yamel Delgado (`D`)
- *Ewé — o uso das plantas na sociedade iorubá* — Pierre Verger (ewes e encantamentos)

O site é estático (HTML + JS, sem servidor e sem build) e funciona sem internet. Os dados vêm, sem
alteração, do índice original em `fonte/ifa-indice-completo-final.html`.

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

Nada está publicado: o repositório é privado e o Pages está desligado. Para publicar depois:
*Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`*.

Antes, saiba que:

- No plano gratuito o GitHub Pages só funciona com repositório **público**; em repositório privado
  exige GitHub Pro/Team. E o site publicado é público de qualquer forma (a tag `noindex` só pede aos
  buscadores para não indexar).
- Os PDFs **não** vão junto (estão no `.gitignore`). Quem abrir o site publicado escolhe os próprios
  PDFs no aparelho, e o leitor funciona igual.
- A aba **“Meu itá”** traz o seu registro pessoal (odus e datas), que ficaria visível para quem tiver
  o link.
- O arquivo `.nojekyll` já está na raiz, para o Pages servir os arquivos como estão.

## Estrutura

```
index.html                 índice (todas as abas do original)
leitor.html                leitor de PDF embutido
assets/app.js              lógica do índice + geração dos links de página
assets/data.js             dados do índice (gerado — não editar à mão)
assets/leitor.js|.css      leitor
assets/style.css           estilo do índice
assets/fonts.css, fonts/   IBM Plex Sans/Mono e Fraunces locais (SIL OFL)
vendor/pdfjs/              PDF.js 3.11.174 (Apache-2.0)
fonte/                     índice original (fonte dos dados)
tools/extrair_dados.py     regenera assets/data.js a partir do índice original
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
