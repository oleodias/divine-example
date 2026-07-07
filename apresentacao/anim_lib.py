# -*- coding: utf-8 -*-
"""Injeta transição fade + entrada fade sequencial (forma canônica PowerPoint)."""
from pptx.oxml.ns import qn
from lxml import etree

def _el(tag, **a):
    e = etree.Element(qn(tag))
    for k, v in a.items(): e.set(k, str(v))
    return e
def _sub(p, tag, **a):
    e = etree.SubElement(p, qn(tag))
    for k, v in a.items(): e.set(k, str(v))
    return e

def add_fade_transition(slide, spd="med"):
    sld = slide.element
    for ex in sld.findall(qn('p:transition')): sld.remove(ex)
    tr = _el('p:transition', spd=spd); tr.append(_el('p:fade'))
    timing = sld.find(qn('p:timing'))
    (timing.addprevious(tr) if timing is not None else sld.append(tr))

def set_entrance(slide, groups, first_delay=200, step_delay=350, dur=420):
    """groups: lista de grupos; cada grupo = lista de spids que entram juntos (fade).
       Grupos entram em sequência automática (After Previous)."""
    sld = slide.element
    for ex in sld.findall(qn('p:timing')): sld.remove(ex)
    if not any(groups): return

    timing = _el('p:timing')
    tnLst = _sub(timing, 'p:tnLst')
    par = _sub(tnLst, 'p:par')
    root = _sub(par, 'p:cTn', id=1, dur="indefinite", restart="never", nodeType="tmRoot")
    rc = _sub(root, 'p:childTnLst')
    seq = _sub(rc, 'p:seq', concurrent=1, nextAc="seek")
    mseq = _sub(seq, 'p:cTn', id=2, dur="indefinite", nodeType="mainSeq")
    mc = _sub(mseq, 'p:childTnLst')

    counter = [3]
    def nid():
        v = counter[0]; counter[0] += 1; return v

    for gi, grp in enumerate(groups):
        if not grp: continue
        # nível 1: nó de "clique/auto"
        p1 = _sub(mc, 'p:par')
        c1 = _sub(p1, 'p:cTn', id=nid(), fill="hold")
        st1 = _sub(c1, 'p:stCondLst')
        _sub(st1, 'p:cond', delay=(first_delay if gi == 0 else step_delay))
        cc1 = _sub(c1, 'p:childTnLst')
        # nível 2: agrupador
        p2 = _sub(cc1, 'p:par')
        c2 = _sub(p2, 'p:cTn', id=nid(), fill="hold")
        st2 = _sub(c2, 'p:stCondLst'); _sub(st2, 'p:cond', delay=0)
        cc2 = _sub(c2, 'p:childTnLst')
        # nível 3: efeitos (1º = afterEffect, demais = withEffect)
        for si, spid in enumerate(grp):
            p3 = _sub(cc2, 'p:par')
            c3 = _sub(p3, 'p:cTn', id=nid(), presetID=10, presetClass="entr",
                      presetSubtype=0, fill="hold", grpId=0,
                      nodeType=("afterEffect" if si == 0 else "withEffect"))
            st3 = _sub(c3, 'p:stCondLst'); _sub(st3, 'p:cond', delay=0)
            cc3 = _sub(c3, 'p:childTnLst')
            # set visibility -> visible
            setEl = _sub(cc3, 'p:set')
            cb = _sub(setEl, 'p:cBhvr')
            cbt = _sub(cb, 'p:cTn', id=nid(), dur=1, fill="hold")
            stx = _sub(cbt, 'p:stCondLst'); _sub(stx, 'p:cond', delay=0)
            tg = _sub(cb, 'p:tgtEl'); _sub(tg, 'p:spTgt', spid=spid)
            al = _sub(cb, 'p:attrNameLst'); an = _sub(al, 'p:attrName'); an.text = "style.visibility"
            to = _sub(setEl, 'p:to'); _sub(to, 'p:strVal', val="visible")
            # animEffect fade in
            ae = _sub(cc3, 'p:animEffect', transition="in", filter="fade")
            cb2 = _sub(ae, 'p:cBhvr')
            _sub(cb2, 'p:cTn', id=nid(), dur=dur)
            tg2 = _sub(cb2, 'p:tgtEl'); _sub(tg2, 'p:spTgt', spid=spid)

    pc = _sub(seq, 'p:prevCondLst'); cc = _sub(pc, 'p:cond', evt="onPrev", delay=0)
    t = _sub(cc, 'p:tgtEl'); _sub(t, 'p:sldTgt')
    nc = _sub(seq, 'p:nextCondLst'); cc = _sub(nc, 'p:cond', evt="onNext", delay=0)
    t = _sub(cc, 'p:tgtEl'); _sub(t, 'p:sldTgt')

    # bldLst (registro dos builds por forma)
    bl = _sub(timing, 'p:bldLst')
    for grp in groups:
        for spid in grp:
            _sub(bl, 'p:bldP', spid=spid, grpId=0, animBg="1")
    sld.append(timing)
