# -*- coding: utf-8 -*-
"""
Migra o .json do editor Divine para o formato novo:
  - remove o número do texto das etapas (numeração passa a ser automática);
  - renomeia: Custo -> Custo e preço de venda; Lançamento -> Campanha de lançamento;
  - insere "Compras" antes de "Tabela comercial" e "Produção" depois;
  - adiciona o campo linkPesquisa (vazio) por projeto;
  - preserva status, responsáveis, prazos e a ordem dos projetos.

Uso: python3 migra_dados.py entrada.json saida.json
"""
import sys, re, json

RENAME = {
    "Custo": "Custo e preço de venda",
    "Lançamento": "Campanha de lançamento",
}

def strip_num(n):
    # remove "9. ", "10) ", e o errinho "4. . "
    return re.sub(r'^\s*\d+\s*[\.\)]\s*(?:\.\s*)?', '', (n or '')).strip()

def migra_etapas(etapas):
    base = []
    for e in etapas or []:
        nm = strip_num(e.get('n'))
        nm = RENAME.get(nm, nm)
        base.append({'n': nm, 'st': e.get('st', 'n'),
                     'resp': e.get('resp', ''), 'prev': e.get('prev', '')})
    out = []
    for e in base:
        if e['n'] == "Tabela comercial":
            out.append({'n': "Compras", 'st': 'n', 'resp': '', 'prev': ''})
            out.append(e)
            out.append({'n': "Produção", 'st': 'n', 'resp': '', 'prev': ''})
        else:
            out.append(e)
    return out

def migra(d):
    for p in d.get('projects', []):
        p['etapas'] = migra_etapas(p.get('etapas'))
        if 'linkPesquisa' not in p:
            p['linkPesquisa'] = ''
    return d

if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    d = json.load(open(src, encoding='utf-8'))
    d = migra(d)
    json.dump(d, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    n = len(d.get('projects', []))
    ne = len(d['projects'][0]['etapas']) if n else 0
    print(f"migrado: {n} projetos | {ne} etapas/projeto | -> {dst}")
