#!/usr/bin/env python3
"""Propõe marcas tonais com base nos nomes yorùbá indexados no Ewé de Verger.

As propostas são checkpoints de revisão, não correções automáticas: uma mesma forma
sem marcas pode corresponder a palavras distintas. Só entradas aprovadas manualmente
em yoruba-tonos-aprovados.json podem ser aplicadas a uma cópia da transcrição.
"""

import argparse
import collections
import datetime
import gzip
import json
import pathlib
import re
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parent.parent
TRANSCRIPT = ROOT / "assets" / "transcricoes.json.gz"
APPROVED = pathlib.Path(__file__).with_name("yoruba-tonos-aprovados.json")
OUTPUT = ROOT / "assets" / "yoruba-tonos-revisao.json"
TOKEN = re.compile(r"[^\W\d_]+", re.UNICODE)
STOPWORDS = {
    "a", "ao", "aos", "as", "com", "como", "da", "das", "de", "del", "do",
    "dos", "el", "en", "es", "la", "las", "los", "na", "no", "nos", "o",
    "os", "para", "por", "que", "se", "the", "três", "tres", "um", "uma"
}


def plain(word):
    return "".join(
        char for char in unicodedata.normalize("NFD", word.casefold())
        if unicodedata.category(char) != "Mn"
    )


def read_data():
    if not TRANSCRIPT.exists():
        raise SystemExit(f"Dados de transcrição não encontrados em {TRANSCRIPT}; "
                         "execute node tools/transcrever.js")
    with gzip.open(TRANSCRIPT, "rt", encoding="utf-8") as stream:
        return json.load(stream)


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
            for page_number in section["pages"]:
                text = data["sources"][source]["textPages"][str(page_number)]
                for match in TOKEN.finditer(text):
                    original = match.group()
                    if len(original) < 3 or plain(original) in STOPWORDS:
                        continue
                    options = lexicon.get(plain(original), [])
                    if not options or original in options:
                        continue
                    key = (source, plain(original), tuple(options))
                    proposal = proposals.setdefault(key, {
                        "source": source,
                        "normalized": plain(original),
                        "suggestions": options,
                        "occurrences": 0,
                        "sourceForms": set(),
                        "pages": set(),
                        "odus": set(),
                        "contexts": []
                    })
                    proposal["occurrences"] += 1
                    proposal["sourceForms"].add(original)
                    proposal["pages"].add(page_number)
                    proposal["odus"].add(odu["cell"])
                    if len(proposal["contexts"]) < 3:
                        proposal["contexts"].append({
                            "page": page_number,
                            "odu": odu["cell"],
                            "text": text[max(0, match.start() - 50):
                                         min(len(text), match.end() + 50)]
                        })
    result = []
    for proposal in proposals.values():
        proposal["sourceForms"] = sorted(proposal["sourceForms"])
        proposal["pages"] = sorted(proposal["pages"])
        proposal["odus"] = sorted(proposal["odus"])
        result.append(proposal)
    return sorted(result, key=lambda item: (
        item["source"], item["normalized"], item["suggestions"]
    ))


def apply_approved(data, approved, lexicon):
    count = 0
    for original, replacement in approved.items():
        if (plain(original) not in lexicon or
                replacement not in lexicon[plain(original)]):
            raise SystemExit(f"Correção não confirmada pelo vocabulário de referência: "
                             f"{original} → {replacement}")
    for source in ("N", "D"):
        for page_number, text in data["sources"][source]["textPages"].items():
            for original, replacement in approved.items():
                pattern = re.compile(rf"(?<!\w){re.escape(original)}(?!\w)", re.I)

                def preserve_case(match):
                    found = match.group()
                    if found.isupper():
                        return replacement.upper()
                    if found.islower():
                        return replacement.lower()
                    if found[:1].isupper():
                        return replacement[:1].upper() + replacement[1:]
                    return replacement

                text, changed = pattern.subn(preserve_case, text)
                count += changed
            data["sources"][source]["textPages"][page_number] = text
    return count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply-approved", action="store_true",
                        help="aplica somente o dicionário revisado e aprovado")
    args = parser.parse_args()
    data = read_data()
    lexicon = build_lexicon(data)
    proposals = collect_proposals(data, lexicon)
    OUTPUT.write_text(json.dumps({
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "reference": "Nomes yorùbá indexados em assets/transcricoes.json.gz (Ewé/Verger)",
        "reviewed": False,
        "proposals": proposals
    }, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(proposals)} propostas aguardam revisão em {OUTPUT.relative_to(ROOT)}")

    if args.apply_approved:
        approved = json.loads(APPROVED.read_text(encoding="utf-8"))
        changed = apply_approved(data, approved, lexicon)
        with gzip.open(TRANSCRIPT, "wt", encoding="utf-8", compresslevel=9) as stream:
            json.dump(data, stream, ensure_ascii=False, separators=(",", ":"))
        print(f"{changed} ocorrências revisadas aplicadas à transcrição")


if __name__ == "__main__":
    main()
