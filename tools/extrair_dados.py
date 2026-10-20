#!/usr/bin/env python3
"""Gera assets/data.js a partir do índice original (fonte/ifa-indice-completo-final.html).

O índice original traz todo o mapeamento num bloco <script id="data" type="application/json">.
Este script copia esse bloco, sem alterar nada, para assets/data.js, que o site carrega
como script comum (funciona também abrindo o index.html direto do disco, via file://).

Uso:  python3 tools/extrair_dados.py [caminho/do/indice.html]
"""
import json
import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
fonte = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "fonte" / "ifa-indice-completo-final.html"

html = fonte.read_text(encoding="utf-8")
m = re.search(r'<script id="data" type="application/json">(.*?)</script>', html, re.S)
if not m:
    sys.exit(f"Bloco de dados não encontrado em {fonte}")

texto = m.group(1)
dados = json.loads(texto)  # valida o JSON antes de gravar

saida = RAIZ / "assets" / "data.js"
saida.write_text(
    "/* Gerado por tools/extrair_dados.py a partir de " + fonte.name + " — não editar à mão. */\n"
    "window.IFA_DATA=JSON.parse(" + json.dumps(texto, ensure_ascii=False) + ");\n",
    encoding="utf-8",
)
print(f"{saida.relative_to(RAIZ)}: {len(dados['odus'])} odus, {len(dados['orishas'])} entradas, "
      f"{len(dados['ewe']['rows'])} espécies (Verger)")
