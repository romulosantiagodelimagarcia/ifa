# Índice de Ifá — versão para navegador

Índice remissivo dos patakís, obras, adimús e ewes nos 256 odus, com **cada título e cada número de
página funcionando como link que abre o PDF exatamente naquela página**:

- *Colección de Ifá* — Roberto Naveira (`N`)
- *Tratado Enciclopédico de Caminos de Ifá* — Yamel Delgado (`D`)
- *Ewé — o uso das plantas na sociedade iorubá* — Pierre Verger (ewes e encantamentos)

O site é estático (HTML + JS, sem servidor e sem build) e funciona sem internet. Os dados vêm, sem
alteração, do índice original em `fonte/ifa-indice-completo-final.html`.

## Transcrições

`transcricao.html` reúne o texto extraído de todas as páginas de Naveira, Delgado e Verger. A aba
“Texto completo” permite trocar de obra, navegar por página e pesquisar no texto; “Por odu” agrupa
trechos de Naveira e Delgado, e “Ewé indexado” continua mostrando as páginas relacionadas às espécies.
Cada página tem um link para o leitor PDF e a interface informa a cobertura de cada obra. As fontes
permanecem identificadas separadamente: a extração não presume que histórias em páginas semelhantes
sejam correspondentes nem determina com segurança os limites de cada narrativa individual.

Para regenerar a transcrição a partir dos PDFs reconhecíveis na raiz:

```
node tools/transcrever.js
```

O extrator valida os 256 pontos de início de odu de cada tratado e extrai o texto reconhecível de todas
as páginas dos três PDFs, incluindo as 618 páginas do Verger. Os textos de cada fonte são armazenados
uma única vez; o agrupamento por odu e o índice de Ewé referenciam essas páginas. Checkpoints locais
permitem retomar uma execução interrompida. O estado temporário fica em `tools/.transcricao-state/`
e não é publicado. Os nomes científicos, famílias, páginas e nomes yorùbá de Ewé vêm do índice.
O resultado é `assets/transcricoes.json.gz`; o navegador o descompacta ao abrir `transcricao.html`.
“Todas as páginas” significa que todas foram processadas: páginas sem camada de texto reconhecível
fazem o extrator parar com erro, e o texto extraído ainda pode conter falhas de OCR.

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
transcricao.html           transcrições por odu e Ewé
leitor.html                leitor de PDF embutido
assets/app.js              lógica do índice + geração dos links de página
assets/data.js             dados do índice (gerado — não editar à mão)
assets/transcricoes.json.gz texto extraído comprimido (gerado)
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
