/* Divine — pós-processa o .pptx do pptxgenjs para adicionar:
   - transição fade em todos os slides;
   - entrada fade em cascata das formas marcadas com objectName "av|N"
     (N = ordem do grupo; formas do mesmo N entram juntas).
   Também renumera os cNvPr id de cada slide para garantir unicidade
   (o pptxgenjs às vezes repete id entre tabela e outras formas).

   Uso (browser):  DivineAnim.process(arrayBuffer, JSZip) -> Promise<Blob>
   Uso (node):     process(buffer, require('jszip')) -> Promise<Buffer/Blob> */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DivineAnim = factory();
})(typeof self !== "undefined" ? self : this, function () {

  function timingXml(groups, o) {
    o = o || {};
    const firstDelay = o.firstDelay != null ? o.firstDelay : 200;
    const stepDelay = o.stepDelay != null ? o.stepDelay : 350;
    const dur = o.dur != null ? o.dur : 420;
    let id = 3;
    const nid = () => id++;
    let steps = "";
    let bld = "";
    groups.forEach((grp, gi) => {
      if (!grp.length) return;
      const delay = gi === 0 ? firstDelay : stepDelay;
      let effects = "";
      grp.forEach((spid, si) => {
        const nodeType = si === 0 ? "afterEffect" : "withEffect";
        effects +=
          `<p:par><p:cTn id="${nid()}" presetID="10" presetClass="entr" presetSubtype="0" fill="hold" grpId="0" nodeType="${nodeType}">` +
          `<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>` +
          `<p:set><p:cBhvr><p:cTn id="${nid()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>` +
          `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr>` +
          `<p:to><p:strVal val="visible"/></p:to></p:set>` +
          `<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="${nid()}" dur="${dur}"/>` +
          `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cBhvr></p:animEffect>` +
          `</p:childTnLst></p:cTn></p:par>`;
        bld += `<p:bldP spid="${spid}" grpId="0" animBg="1"/>`;
      });
      steps +=
        `<p:par><p:cTn id="${nid()}" fill="hold"><p:stCondLst><p:cond delay="${delay}"/></p:stCondLst><p:childTnLst>` +
        `<p:par><p:cTn id="${nid()}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>` +
        effects +
        `</p:childTnLst></p:cTn></p:par>` +
        `</p:childTnLst></p:cTn></p:par>`;
    });
    if (!steps) return "";
    return (
      `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>` +
      `<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>` +
      steps +
      `</p:childTnLst></p:cTn>` +
      `<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>` +
      `<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>` +
      `</p:seq></p:childTnLst></p:cTn></p:par></p:tnLst>` +
      `<p:bldLst>${bld}</p:bldLst></p:timing>`
    );
  }

  const TRANSITION = `<p:transition spd="med"><p:fade/></p:transition>`;

  function processSlideXml(xml, opts) {
    // 1) renumera todos os cNvPr id de forma única; coleta grupos "av|N"
    let counter = 0;
    const groupsMap = {};
    xml = xml.replace(/<p:cNvPr id="(\d+)" name="([^"]*)"/g, function (m, _id, name) {
      counter += 1;
      const newId = counter;
      let outName = name;
      const g = /^av\|(\d+)$/.exec(name);
      if (g) {
        (groupsMap[+g[1]] = groupsMap[+g[1]] || []).push(newId);
        outName = ""; // limpa o marcador para não poluir o painel de seleção
      }
      return `<p:cNvPr id="${newId}" name="${outName}"`;
    });

    // 2) monta grupos em ordem
    const keys = Object.keys(groupsMap).map(Number).sort((a, b) => a - b);
    const groups = keys.map(k => groupsMap[k]);
    const timing = timingXml(groups, opts);

    // 3) injeta transição + timing antes de </p:sld>
    xml = xml.replace("</p:sld>", TRANSITION + timing + "</p:sld>");
    return xml;
  }

  async function process(data, JSZip, opts) {
    const zip = await JSZip.loadAsync(data);
    const slideFiles = Object.keys(zip.files).filter(
      n => /^ppt\/slides\/slide\d+\.xml$/.test(n)
    );
    for (const name of slideFiles) {
      const xml = await zip.file(name).async("string");
      zip.file(name, processSlideXml(xml, opts));
    }
    const isNode = typeof module === "object" && module.exports;
    return zip.generateAsync({
      type: isNode ? "nodebuffer" : "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
  }

  return { process, processSlideXml, timingXml };
});
