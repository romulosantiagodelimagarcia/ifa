#!/usr/bin/env python3
"""Propõe marcas tonais com base nos nomes yorùbá indexados no Ewé de Verger.

As propostas são checkpoints de revisão, não correções automáticas: uma mesma forma
sem marcas pode corresponder a palavras distintas. Só entradas aprovadas manualmente
em yoruba-tonos-aprovados.json podem ser aplicadas a uma cópia da transcrição.
"""

import argparse
import collections
import datetime
import json
import pathlib
import re
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parent.parent
TRANSCRIPT = ROOT / "assets" / "transcricoes.js"
APPROVED = pathlib.Path(__file__).with_name("yoruba-tonos-aprovados.json")
OUTPUT = ROOT / "assets" / "yoruba-tonos-revisao.json"
TOKEN = re.compile(r"[^\W\d_]+", re.UNICODE)
DATA = re.compile(r"window\.IFA_TRANSCRIPT=(.*);\s*$", re.S)


def plain(word):
    return "".join(
        char for char in unicodedata.normalize("NFD", word.casefold())
        if unicodedata.category(char) != "Mn"
    )


def read_data():
    text = TRANSCRIPT.read_text(encoding="utf-8")
    match = DATA.search(text)
    if not match:
        raise SystemExit(f"Dados de transcrição não encontrados em {TRANSCRIPT}")
    return json.loads(match.group(1))


def build_lexicon(data):
    forms = collections.defaultdict(set)
    for row in data["ewe"]["rows"]:
        for term in row["yoruba"]:
            for word in TOKEN.findall(term):
                if any(unicodedata.category(char) == "Mn"
                       for char in unicodedata.normalize("NFD", word)):
                    forms[plain(word)].add(word)
    return {key: sorted(value) for key, value in forms.items()}


def collect_proposals(data, lexicon):
    proposals = {}
    for odu in data["odus"]:
        for source in ("N", "D"):
            section = odu["sources"][source]
            for page in section["pages"]:
                for match in TOKEN.finditer(page["text"]):
                    original = match.group()
                    options = lexicon.get(plain(original), [])
                    if not options or original in options:
                        continue
                    key = (source, page["page"], match.start())
                    proposals[key] = {
                        "source": source,
                        "odu": odu["cell"],
                        "page": page["page"],
                        "offset": match.start(),
                        "original": original,
                        "suggestions": options,
                        "context": page["text"][max(0, match.start() - 50):
                                                  min(len(page["text"]), match.end() + 50)]
                    }
    return sorted(proposals.values(), key=lambda item: (
        item["source"], item["page"], item["offset"]
    ))


def apply_approved(data, approved):
    count = 0
    for odu in data["odus"]:
        for source in ("N", "D"):
            for page in odu["sources"][source]["pages"]:
                text = page["text"]
                for original, replacement in approved.items():
                    if plain(original) == plain(replacement) and original != replacement:
                        pattern = re.compile(rf"(?<!\w){re.escape(original)}(?!\w)", re.I)
                        text, changed = pattern.subn(lambda _: replacement, text)
                        count += changed
                page["text"] = text
    return count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply-approved", action="store_true",
                        help="aplica somente o dicionário revisado e aprovado")
    args = parser.parse_args()
    data = read_data()
    proposals = collect_proposals(data, build_lexicon(data))
    OUTPUT.write_text(json.dumps({
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "reference": "Nomes yorùbá indexados em assets/transcricoes.js (Ewé/Verger)",
        "reviewed": False,
        "proposals": proposals
    }, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(proposals)} propostas aguardam revisão em {OUTPUT.relative_to(ROOT)}")

    if args.apply_approved:
        approved = json.loads(APPROVED.read_text(encoding="utf-8"))
        changed = apply_approved(data, approved)
        TRANSCRIPT.write_text(
            "/* Gerado por tools/transcrever.js; tons aprovados aplicados por "
            "tools/restaurar_tons.py. */\nwindow.IFA_TRANSCRIPT=" +
            json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n",
            encoding="utf-8"
        )
        print(f"{changed} ocorrências revisadas aplicadas à transcrição")


if __name__ == "__main__":
    main()
