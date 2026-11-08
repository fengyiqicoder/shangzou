(function () {
  const { EMPERORS, HONORIFICS, EXAMPLES, route, coverText, formula, cn, yearName, jiajingShoufu } = window.SZ;
  const $ = (s) => document.querySelector(s);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pace = (ms) => (reduce ? Math.min(ms, 120) : ms);

  if (window.onetag) onetag.configure({ key: window.SHANGZOU_KEY });

  const state = { emp: "yongzheng", body: "", reply: null, c: null, busy: false };

  /* ---------- 日期：今天的农历月日 ---------- */
  function lunarToday() {
    try {
      const parts = new Intl.DateTimeFormat("en-u-ca-chinese", { month: "numeric", day: "numeric" }).formatToParts(new Date());
      const mv = parts.find((p) => p.type === "month").value;
      return { m: parseInt(mv, 10), d: parseInt(parts.find((p) => p.type === "day").value, 10), leap: /bis|L/i.test(mv) };
    } catch (e) {
      const t = new Date();
      return { m: t.getMonth() + 1, d: t.getDate(), leap: false };
    }
  }
  const monthName = (m) => (m === 1 ? "正" : cn(m)) + "月";
  const dayName = (d) => (d <= 10 ? "初" + cn(d) : cn(d)) + "日";
  function dateText(c) {
    const l = lunarToday();
    return c.emp.era + yearName(c.year) + (l.leap ? "閏" : "") + monthName(l.m) + dayName(l.d);
  }

  /* ---------- 表单 ---------- */
  function officesFor(emp, y) {
    return emp.offices.filter((o) => (!o.minYear || y >= o.minYear) && (!o.maxYear || y <= o.maxYear));
  }
  const NAME_HINT = { jiajing: "如：海瑞", kangxi: "如：曹寅", yongzheng: "如：田文鏡" };

  function buildEmperors() {
    const box = $("#emperors");
    box.innerHTML = "";
    Object.values(EMPERORS).forEach((e) => {
      const b = document.createElement("button");
      b.className = "emp " + e.tone;
      b.type = "button";
      b.setAttribute("role", "radio");
      b.dataset.id = e.id;
      b.innerHTML = `<b class="era">${e.era}</b><span class="who">${e.title} ${e.personal}</span><span class="reign">在位 ${e.reign}</span><p>${e.blurb}</p>`;
      b.addEventListener("click", () => selectEmp(e.id));
      box.append(b);
    });
    // 方向键在单选组里切换
    box.addEventListener("keydown", (ev) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(ev.key)) return;
      const ids = Object.keys(EMPERORS);
      let i = ids.indexOf(state.emp) + (ev.key === "ArrowLeft" || ev.key === "ArrowUp" ? -1 : 1);
      i = (i + ids.length) % ids.length;
      selectEmp(ids[i]);
      box.querySelector(`[data-id="${ids[i]}"]`).focus();
      ev.preventDefault();
    });
  }

  function selectEmp(id) {
    state.emp = id;
    const e = EMPERORS[id];
    document.querySelectorAll(".emp").forEach((b) => {
      const on = b.dataset.id === id;
      b.setAttribute("aria-checked", on);
      b.tabIndex = on ? 0 : -1;
    });
    const ys = $("#year");
    ys.innerHTML = "";
    for (let y = 1; y <= e.years; y++) ys.add(new Option(`${yearName(y)}（${e.firstAD + y - 1}）`, y));
    $("#yearLabel").textContent = e.era + "年间";
    $("#empNote").innerHTML = `<b>${e.title} ${e.personal}</b> · 在位 ${e.reign}<br>${e.blurb}`;
    ys.value = e.defaultYear;
    fillOffices();
    $(".banner-field").hidden = e.tone !== "qing";
    const dt = $("#doctype");
    dt.innerHTML = "";
    e.docTypes.forEach((d) => dt.add(new Option(d.name, d.id)));
    docHint();
    $("#name").placeholder = NAME_HINT[id];
    const ex = $("#examples");
    ex.innerHTML = "";
    EXAMPLES[id].forEach(([label, text]) => {
      const c = document.createElement("button");
      c.type = "button";
      c.className = "chip";
      c.textContent = label;
      c.addEventListener("click", () => {
        $("#content").value = text;
        $("#content").focus();
      });
      ex.append(c);
    });
  }

  function fillOffices() {
    const e = EMPERORS[state.emp];
    const y = +$("#year").value;
    const sel = $("#office");
    const prev = sel.selectedOptions[0] && sel.selectedOptions[0].text;
    sel.innerHTML = "";
    officesFor(e, y).forEach((o, i) => sel.add(new Option(o.name, i)));
    sel.add(new Option("自拟官职…", "custom"));
    const keep = [...sel.options].find((o) => o.text === prev);
    if (keep) sel.value = keep.value;
    $(".custom-office").hidden = sel.value !== "custom";
  }

  function docHint() {
    const e = EMPERORS[state.emp];
    const d = e.docTypes.find((x) => x.id === $("#doctype").value);
    $("#docHint").textContent = d ? `${d.name}：${d.hint}。` : "";
  }

  function readCtx() {
    const emp = EMPERORS[state.emp];
    const year = +$("#year").value;
    let office;
    if ($("#office").value === "custom") office = { name: $("#officeCustom").value.trim() || "某官", jing: true };
    else office = officesFor(emp, year)[+$("#office").value];
    const banner = emp.tone === "qing" && $("#banner").value === "1";
    const self = emp.selfTerm(banner);
    const docType = emp.docTypes.find((d) => d.id === $("#doctype").value) || emp.docTypes[0];
    const li = office.li || 0;
    return {
      emp, year, ad: emp.firstAD + year - 1, era: emp.era,
      office: office.name, jing: !!office.jing || !li, li, days: Math.max(1, Math.ceil(li / 300)),
      name: $("#name").value.trim() || "某", self, banner, docType,
    };
  }

  /* ---------- 排版：竖行、抬头、偏书、句读 ---------- */
  const PUNCT = "，。、；：！？,.;:!?…—";
  const DROP = "「」『』“”‘’\"'《》〈〉（）()[]【】 \r\t　*#-_";
  const NOT_SELF_BEFORE = "大群諸人忠功使重近權奸廷朝老文武相宰君社謀賢";

  function layout(text, cap, indent, honor) {
    const cols = [];
    const flat = [];
    let cur;
    const newCol = (top) => { cur = { top, cells: [] }; cols.push(cur); };
    newCol(indent);
    let lastHonEnd = -1;
    let i = 0;
    while (i < text.length) {
      const ch = text[i];
      if (ch === "\n") { if (cur.cells.length) newCol(indent); i++; continue; }
      if (DROP.includes(ch)) { i++; continue; }
      if (PUNCT.includes(ch)) {
        const last = flat[flat.length - 1];
        if (last && !last.mark) last.mark = "。！？.!?".includes(ch) ? "ju" : "dou";
        i++;
        continue;
      }
      const hon = honor ? HONORIFICS.find((h) => text.startsWith(h, i)) : null;
      if (hon && lastHonEnd !== flat.length) {
        if (cur.cells.length) newCol(0); else cur.top = 0;
      }
      const n = hon ? hon.length : 1;
      for (let k = 0; k < n; k++) {
        if (cur.top + cur.cells.length >= cap) newCol(indent);
        const c = { ch: text[i + k], mark: null, self: false };
        cur.cells.push(c);
        flat.push(c);
      }
      if (hon) lastHonEnd = flat.length;
      i += n;
    }
    for (let j = 0; j < flat.length; j++) {
      const ch = flat[j].ch;
      if (ch === "臣" && !(j > 0 && NOT_SELF_BEFORE.includes(flat[j - 1].ch))) flat[j].self = true;
      if (ch === "奴" && flat[j + 1] && flat[j + 1].ch === "才") { flat[j].self = flat[j + 1].self = true; }
    }
    return { cols: cols.filter((c) => c.cells.length), flat };
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function colEl(col, kind) {
    const d = el("div", "col " + kind);
    for (let t = 0; t < col.top; t++) d.append(el("span", "ch"));
    col.cells.forEach((c) => {
      const s = el("span", "ch" + (c.self ? " self" : "") + (c.mark ? " m-" + c.mark : ""), c.ch);
      c.el = s;
      d.append(s);
    });
    return d;
  }

  const strip = (s) => (s || "").split("").filter((ch) => !PUNCT.includes(ch) && !DROP.includes(ch) && ch !== "\n").join("");

  function render(opts = {}) {
    const c = state.c;
    const r = state.reply;
    const zhe = $("#zhe");
    zhe.innerHTML = "";
    zhe.className = "zhe " + c.emp.tone + ($("#judou").checked ? "" : " nojudou");

    // 折面
    const cover = el("div", "panel cover " + (c.emp.tone === "ming" ? "ming" : c.docType.id === "qingan" ? "huang" : ""));
    const ct = coverText(c.docType.id);
    const title = el("div", "cover-title" + (ct.length > 1 ? " small" : ""));
    ct.split("").forEach((ch) => title.append(el("span", "", ch)));
    cover.append(title);
    if (c.emp.tone === "ming" && r) {
      if (r.piaoni) {
        const slip = el("div", "slip" + (opts.animate ? " in" : ""));
        layout(r.piaoni, 30, 0, false).flat.forEach((x) => slip.append(el("span", "ch", x.ch)));
        cover.append(slip);
      }
      if (r.pihong && !r.liuzhong) {
        const ph = el("div", "pihong write");
        layout(r.pihong, 14, 0, false).cols.forEach((col) => ph.append(colEl(col, "zhu")));
        cover.append(ph);
        title.style.opacity = "0.35";
      }
    }
    zhe.append(cover);

    // 正文
    const body = layout(state.body, 20, 2, true);
    const items = body.cols.map((col) => ({ node: colEl(col, "body"), w: 1 }));
    if (opts.cursor && body.flat.length) {
      const last = body.flat[body.flat.length - 1].el;
      last.classList.add("cursor");
      requestAnimationFrame(() => followX(last, false));
    }

    if (state.body.trim() && !opts.cursor) {
      const dc = layout(dateText(c), 20, 2, false).cols[0];
      if (c.emp.tone === "ming") {
        items.push({ node: colEl(dc, "date"), w: 1 });
        const sig = layout(c.office + "臣" + c.name, 20, 6, false);
        sig.flat.forEach((x) => { if (x.ch === "臣") x.self = true; });
        sig.cols.forEach((col) => items.push({ node: colEl(col, "date"), w: 1 }));
      } else {
        items.push({ node: colEl(dc, "date"), w: 1 });
      }
    }

    // 清：朱批、夹批、圈点
    if (r && c.emp.tone === "qing") {
      const hay = body.flat.map((x) => x.ch).join("");
      (r.quan || []).forEach((q) => {
        const n = strip(q);
        const at = n ? hay.indexOf(n) : -1;
        if (at < 0) return;
        for (let k = at; k < at + n.length; k++) body.flat[k].el.classList.add("quan", "wait");
      });
      (r.jiapi || []).forEach((jp) => {
        const n = strip(jp.at);
        let at = n ? hay.indexOf(n) : -1;
        if (at < 0 && n.length > 4) at = hay.indexOf(n.slice(0, 4));
        if (at < 0) return;
        const host = body.flat[at].el;
        const box = el("div", "jp write");
        strip(jp.text).split("").forEach((ch) => box.append(el("span", "ch", ch)));
        box.dataset.anchor = "1";
        host.parentElement.append(box);
        box.style.top = host.offsetTop + "px";
        box._host = host;
      });
      if (r.zhupi) {
        items.push({ node: el("div", "col"), w: 1 });
        layout(r.zhupi, 15, 0, false).cols.forEach((col) => {
          const node = colEl(col, "zhu write zhupi");
          node.querySelectorAll(".ch").forEach((s) => {
            s.style.setProperty("--r", (Math.random() * 7 - 3.5).toFixed(1) + "deg");
            s.style.setProperty("--x", (Math.random() * 4 - 2).toFixed(1) + "px");
          });
          items.push({ node, w: 1.3 });
        });
      }
    }

    // 装进每幅六行的经折
    let panel = null, used = 6;
    items.forEach((it) => {
      if (used + it.w > 6.01) { panel = el("div", "panel"); zhe.append(panel); used = 0; }
      panel.append(it.node);
      used += it.w;
    });
    if (!panel || used > 4.5) zhe.append(el("div", "panel"));

    // 夹批的位置要等进了文档才量得到
    zhe.querySelectorAll(".jp").forEach((b) => { if (b._host) b.style.top = b._host.offsetTop + "px"; });
    if (opts.static) zhe.querySelectorAll(".write").forEach((w) => w.classList.add("go"));
    if (opts.static) zhe.querySelectorAll(".quan").forEach((q) => q.classList.remove("wait"));
  }

  // 只横向滚动折子，让某个元素露出来（不动页面的竖向位置）
  function followX(node, smooth) {
    const sc = $("#scroller");
    if (!node || !sc) return;
    const a = node.getBoundingClientRect(), b = sc.getBoundingClientRect();
    const pad = 24;
    let dx = 0;
    if (a.left < b.left + pad) dx = a.left - b.left - pad;
    else if (a.right > b.right - pad) dx = a.right - b.right + pad;
    if (dx) sc.scrollBy({ left: dx, behavior: smooth && !reduce ? "smooth" : "auto" });
  }
  const buzz = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

  let raf = 0;
  const scheduleRender = (opts) => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => render(opts)); };

  /* ---------- 状态显示 ---------- */
  function setStatus(text, busy) {
    const s = $("#deskStatus");
    s.textContent = text;
    s.classList.toggle("busy", !!busy);
  }
  function showDesk() {
    $("#setup").hidden = true;
    $("#desk").hidden = false;
    $("#result").hidden = true;
    $("#draftActions").hidden = true;
    $("#editWrap").hidden = true;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }
  function showSetup() {
    $("#desk").hidden = true;
    $("#setup").hidden = false;
    state.reply = null;
  }
  function errText(e) {
    const code = e && e.code;
    if (code === "quota_exceeded") return "今日递折已满：共享的演示额度用完了，明日再来；自己部署可换上你的 OneTag AI key。";
    if (code === "rate_limited") return "递折太勤，奏事处让你稍候一分钟再来。";
    if (code === "network") return "驿路不通（网络出错），请检查网络后再递。";
    if (code === "bad_json") return "御批字迹潦草，没能认出来，请重新递折。";
    return "驿路受阻：" + ((e && e.message) || "未知错误");
  }

  /* ---------- 师爷誊抄 ---------- */
  function draftSystem(c) {
    const f = formula(c.emp.id, c.docType.id, c.self, c.office, c.name);
    return [
      `你是${c.emp.dynasty}朝${c.era}年间一位老练的书办（师爷），替主人誊写一道${c.docType.name}。`,
      `主人：${c.office}${c.name}，自称「${c.self}」。现在是${c.era}${yearName(c.year)}（公元${c.ad}年）。`,
      `主人用白话口述要奏的事，你把它写成该朝真实体例的${c.docType.name}正文。规则：`,
      `1. 只输出正文本身，全用繁體中文；不要标题、解释、注释、markdown、引号、分段编号。`,
      `2. 文言，取清通浅白的公文语体，不用生僻字。${f.short ? "全文二十字以内。" : "全文一百二十到三百二十字。"}`,
      `3. 开头：${f.open}。`,
      `4. 结尾：${f.close}。`,
      `5. 称皇帝一律用「${c.emp.honor}」一类敬称；自称一律用「${c.self}」。`,
      `6. 不写具奏日期和署名，另有专人添加。`,
      `7. 只用公元${c.ad}年以前已有的人名、官名、地名、典章。口述里若有后世之物，照意思用当时的说法转述；转述不了的就照实写出，由皇上自己去看。`,
      `8. 忠于主人原意，不擅自添加主人没说的事实，可加合乎体例的套语。`,
    ].join("\n");
  }

  async function draft() {
    const content = $("#content").value.trim();
    if (!content) return nudge($("#content"));
    if (state.busy) return;
    state.c = readCtx();
    state.reply = null;
    state.body = "";
    showDesk();
    render({ cursor: true });
    setStatus("师爷正在誊抄……", true);
    state.busy = true;
    try {
      const text = await onetag.ask("把下面主人的口述誊成正文。", content, {
        system: draftSystem(state.c),
        maxTokens: 900,
        stream: (d) => { state.body += d; scheduleRender({ cursor: true }); },
      });
      state.body = clean(text || state.body);
      render();
      setStatus(`${state.c.docType.name}已誊就，请过目`);
      $("#draftActions").hidden = false;
    } catch (e) {
      setStatus(errText(e));
      $("#draftActions").hidden = false;
      $("#submitBtn").disabled = !state.body.trim();
    } finally {
      state.busy = false;
    }
  }

  function clean(t) {
    return (t || "")
      .replace(/```[a-z]*|```/g, "")
      .replace(/^(正文|奏文|奏摺|奏折|奏本|題本)[:：]\s*/m, "")
      .replace(/\n{2,}/g, "\n")
      .trim();
  }

  function direct() {
    const content = $("#content").value.trim();
    if (!content) return nudge($("#content"));
    state.c = readCtx();
    state.reply = null;
    state.body = content;
    showDesk();
    render();
    setStatus("原话照录，一字未改");
    $("#draftActions").hidden = false;
  }

  function nudge(node) {
    node.classList.remove("shake");
    void node.offsetWidth;
    node.classList.add("shake");
    node.focus();
  }

  /* ---------- 皇帝批答 ---------- */
  function emperorSystem(c) {
    const e = c.emp;
    const facts = e.facts.filter(([a, b]) => c.year >= a && c.year <= b).map(([, , t]) => "- " + t).join("\n");
    const lines = [
      `你是${e.title}${e.personal}，年号${e.era}。现在是${e.era}${yearName(c.year)}（公元${c.ad}年）。你正在看${c.office}${c.name}（自称「${c.self}」）上的一道${c.docType.name}。`,
      `你只知道到这一年为止的事：\n${facts}`,
      e.persona,
    ];
    if (e.id === "jiajing")
      lines.push(
        `明代体例：本章先由内阁首辅${jiajingShoufu(c.year)}用墨笔票拟（官样文字，揣摩你的心意），再由司礼监照你的意思用朱笔批红。` +
          `旨意是明代公文白话口吻，例如：「這所奏，該部知道。」「是。依擬行。」「下所司議。」「覽卿奏，具見忠悃。知道了。」「某某著錦衣衛拿送鎮撫司，好生打著問了來說。」「這廝妄言惑眾，著革了職為民。」` +
          `你亲自改票时，语气更峻厉或更玄虚。不想表态的，你就留中不发。`
      );
    else if (e.id === "kangxi")
      lines.push("清代体例：你用朱笔亲批在折尾。请安折通常只批「朕安」，或再加一两句家常。你很少夹批、圈点。");
    else
      lines.push("清代体例：你用朱笔亲批在折尾，也爱在字里行间夹批，在得意或可疑的句子旁画圈。请安折常批「朕安」，借请安说空话的你要敲打。");
    lines.push(
      "规则：始终是皇帝本人，不跳出角色，不提 AI、模型或现代。奏文里若有后世之物、荒诞之言，按你那个时代的见识处置（斥为妄诞，或好奇追问）。" +
        "批语（piaoni、pihong、zhupi、jiapi）用繁體中文和你那个朝代的说法；outcome、baihua、note 三项写给今人看，必须用简体中文。请据实按性情处置：该准就准，该驳就驳，该骂就骂，不要一味温和。"
    );
    return lines.join("\n\n");
  }

  function emperorPrompt(c) {
    if (c.emp.id === "jiajing")
      return (
        "读完下面这道本章，按你的性情和当年处境处置。只输出一个 JSON 对象，不要别的文字：\n" +
        '{"piaoni":"内阁票拟原文（繁體，4到30字，首辅的官样文字）","pihong":"最终批红（繁體，4到80字；你不同意票拟就按你的意思改写；留中则为空字符串）","liuzhong":false,' +
        '"outcome":"结局（简体，2到8字，如：依议、下部议、留中不发、廷杖八十、下诏狱、削籍为民、赏银二十两）","baihua":"批红的白话意思（简体，一两句；留中就说皇帝的态度）","note":"一句史实小注（简体，50字以内，说明为什么这样处置，可引当年真实背景）"}'
      );
    const yz = c.emp.id === "yongzheng";
    return (
      "读完下面这道奏折，按你的性情和当年处境处置。只输出一个 JSON 对象，不要别的文字：\n" +
      `{"zhupi":"朱批正文（繁體；${yz ? "通常10到150字，情绪重时可更长" : "通常2到30字"}）",` +
      '"jiapi":[{"at":"从奏文里原样照抄的一段，4到10字","text":"夹批（繁體，2到14字）"}],"quan":["从奏文里原样照抄的2到8字"],' +
      '"outcome":"结局（简体，2到8字，如：原折发还、交部议、着即办理、严行申饬、革职拿问、赏缎二匹）","baihua":"朱批的白话意思（简体，一两句）","note":"一句史实小注（简体，50字以内，说明为什么这样批，可引当年真实背景）"}\n' +
      (yz ? "jiapi 和 quan 各 0 到 3 条，看情况用。" : "jiapi 和 quan 通常是空数组，最多各 1 条。")
    );
  }

  async function askEmperor(c, body) {
    const r = await onetag.ask(emperorPrompt(c), body, { system: emperorSystem(c), json: true, maxTokens: 900 });
    if (!r || typeof r !== "object") throw { code: "bad_json" };
    const s = (v) => (typeof v === "string" ? v.trim() : "");
    const out = { outcome: s(r.outcome), baihua: s(r.baihua), note: s(r.note) };
    if (c.emp.id === "jiajing") {
      out.piaoni = s(r.piaoni);
      out.pihong = s(r.pihong);
      out.liuzhong = r.liuzhong === true || (!out.pihong && /留中/.test(out.outcome));
      if (out.liuzhong) out.outcome = out.outcome || "留中不发";
    } else {
      out.zhupi = s(r.zhupi) || "知道了。";
      out.jiapi = Array.isArray(r.jiapi) ? r.jiapi.filter((j) => j && s(j.at) && s(j.text)).slice(0, 3) : [];
      out.quan = Array.isArray(r.quan) ? r.quan.map(s).filter(Boolean).slice(0, 3) : [];
    }
    if (!out.outcome) out.outcome = c.emp.tone === "ming" ? "批红发下" : "原折发还";
    return out;
  }

  /* ---------- 流转动画 ---------- */
  const ART = { 具: "write", 繕: "write", 匣: "seal", 驛: "travel", 門: "travel", 通: "travel", 會: "travel", 奏: "travel", 閣: "slip", 苑: "wait", 宮: "wait", 御: "wait", 紅: "red", 硃: "red", 軍: "copy", 科: "return", 還: "return" };

  let capToken = 0;
  async function typeCap(text) {
    const my = ++capToken;
    const cap = $("#flowCap");
    cap.textContent = "";
    for (const ch of text) {
      if (my !== capToken) return;
      cap.textContent += ch;
      await sleep(pace(42));
    }
  }

  async function submit() {
    if (state.busy || !state.body.trim()) return;
    state.busy = true;
    const c = state.c;
    const steps = route(c);
    const flow = $("#flow");
    const art = $("#flowArt");
    if (!art.querySelector(".road")) art.append(el("div", "road"));
    const m = state.body.match(/為(.{2,24}?)事/);
    $("#flowHead").textContent = `${c.era}${yearName(c.year)}　${c.office}${c.self === "奴才" ? "奴才" : "臣"}${c.name}${m ? "　為" + m[1] + "事" : ""}`;
    const ol = $("#route");
    ol.innerHTML = "";
    steps.forEach((s) => {
      const li = el("li");
      li.append(el("i", "", s.k), el("b", "", s.n));
      ol.append(li);
    });
    $("#flowErr").hidden = true;
    $("#flowCap").hidden = false;
    flow.classList.remove("out");
    flow.hidden = false;
    document.body.style.overflow = "hidden";

    let res = null;
    askEmperor(c, state.body).then((r) => (res = { ok: true, r }), (e) => (res = { ok: false, e }));

    const lis = [...ol.children];
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      lis.forEach((li, j) => { li.classList.toggle("on", j === i); li.classList.toggle("done", j < i); });
      if (s.red) lis[i].classList.add("red");
      if (s.time) lis[i].prepend(el("span", "t", s.time));
      art.dataset.st = ART[s.k] || "travel";
      if (art.dataset.st === "seal" || s.red) buzz(18);
      const liu = res && res.ok && res.r.liuzhong;
      if (s.wait) {
        let j = 0;
        const tw = Date.now();
        while (!res || Date.now() - tw < pace(4800)) {
          await typeCap(s.caps[j % s.caps.length]);
          await sleep(pace(1100));
          j++;
        }
        if (!res.ok) { showFlowError(res.e); return; }
        continue;
      }
      let caps = s.caps;
      if (liu && s.liuzhongCaps) caps = s.liuzhongCaps;
      if (liu && s.red) caps = ["万岁爷未置一词", "本章留中"];
      if (s.red && res && res.ok && c.emp.tone === "qing") {
        const r = res.r;
        const extra = [r.jiapi.length && `夹批 ${r.jiapi.length} 处`, r.quan.length && `圈点 ${r.quan.length} 处`].filter(Boolean).join("，");
        caps = [`御笔朱批，凡 ${strip(r.zhupi).length} 字${extra ? "；另有" + extra : ""}`];
      }
      if (s.slip) caps = caps.slice();
      for (const cap of caps) {
        await typeCap(cap);
        await sleep(pace(700));
      }
    }
    lis.forEach((li) => { li.classList.remove("on"); li.classList.add("done"); });
    await sleep(pace(500));
    flow.classList.add("out");
    await sleep(pace(450));
    flow.hidden = true;
    document.body.style.overflow = "";
    state.busy = false;
    state.reply = res.r;
    reveal();
  }

  function showFlowError(e) {
    $("#flowCap").hidden = true;
    $("#flowErrMsg").textContent = errText(e);
    $("#flowErr").hidden = false;
    state.busy = false;
  }
  function closeFlow() {
    $("#flow").hidden = true;
    document.body.style.overflow = "";
  }

  async function reveal() {
    const c = state.c;
    const r = state.reply;
    $("#draftActions").hidden = true;
    $("#editWrap").hidden = true;
    render({ animate: true });
    setStatus(c.emp.tone === "ming" ? (r.liuzhong ? "此本留中不发" : "批红发下") : "朱批发还");
    const scroller = $("#scroller");

    // 先夹批、圈点，再写尾批（明代写在本面）
    let delay = 0;
    const qs = [...document.querySelectorAll(".ch.quan")];
    qs.forEach((q, k) => { q.style.setProperty("--d", k * 0.08 + "s"); q.classList.remove("wait"); q.classList.add("go"); });
    const jps = [...document.querySelectorAll(".jp")];
    if (qs.length || jps.length) {
      const first = (jps[0] && jps[0]._host) || qs[0];
      first.scrollIntoView({ behavior: reduce ? "auto" : "smooth", inline: "center", block: "nearest" });
      await sleep(pace(500));
    }
    for (const b of jps) {
      followX(b, true);
      writeChars(b, 0.14);
      await sleep(pace(b.children.length * 140 + 300));
    }
    const target = c.emp.tone === "ming" ? document.querySelector(".pihong") : document.querySelector(".zhupi");
    if (c.emp.tone === "ming") scroller.scrollTo({ left: 0, behavior: reduce ? "auto" : "smooth" });
    else if (target) target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", inline: "center", block: "nearest" });
    await sleep(pace(600));
    if (target) {
      const nodes = c.emp.tone === "ming" ? [target] : [...document.querySelectorAll(".zhupi")];
      const n = nodes.reduce((a, x) => a + x.querySelectorAll(".ch").length, 0);
      const per = Math.min(0.2, 9 / Math.max(n, 1));
      nodes.forEach((x) => {
        const at = delay;
        delay = writeChars(x, per, delay);
        if (at > 0) setTimeout(() => followX(x, true), pace(at * 1000));
      });
      await sleep(pace(delay * 1000 + 500));
    }
    showResult();
  }

  function writeChars(node, per, start = 0) {
    let d = start;
    node.querySelectorAll(".ch").forEach((s) => {
      if (!s.textContent) return;
      s.style.setProperty("--d", d.toFixed(2) + "s");
      d += per;
    });
    node.classList.add("go");
    return d;
  }

  function showResult() {
    const r = state.reply;
    const o = $("#outcome");
    o.textContent = r.outcome;
    o.classList.toggle("grey", !!r.liuzhong);
    $("#baihua").textContent = r.baihua || "";
    $("#note").textContent = r.note ? "史注：" + r.note : "";
    $("#result").hidden = false;
    buzz([20, 40, 30]);
    $("#result").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  }

  /* ---------- 存图、复制 ---------- */
  async function saveImage() {
    if (!window.html2canvas) return;
    const btn = $("#saveBtn");
    btn.disabled = true;
    try {
      const zhe = $("#zhe");
      const canvas = await html2canvas(zhe, { backgroundColor: "#1b1310", scale: 2, useCORS: true, onclone: (doc) => doc.querySelector("#zhe").classList.add("snap") });
      const fname = `上奏-${state.c.era}${yearName(state.c.year)}-${state.c.name}.png`;
      const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
      const file = blob && new File([blob], fname, { type: "image/png" });
      // 手机上走系统分享（可存到相册、发微信）；不支持就直接下载
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: "上奏" }); return; } catch (e) { if (e && e.name === "AbortError") return; }
      }
      const a = document.createElement("a");
      a.download = fname;
      a.href = blob ? URL.createObjectURL(blob) : canvas.toDataURL("image/png");
      a.click();
    } finally {
      btn.disabled = false;
    }
  }
  function copyText() {
    const c = state.c, r = state.reply;
    const pi = c.emp.tone === "ming" ? (r.liuzhong ? "（留中不发）" : r.pihong) : r.zhupi;
    const text = `我给${c.era}皇帝上了一道${c.docType.name}，${c.emp.tone === "ming" ? "批红" : "朱批"}：${pi}\n—— 上奏 ${location.href.split("#")[0]}`;
    navigator.clipboard.writeText(text).then(() => {
      const b = $("#copyBtn");
      b.textContent = "已复制";
      setTimeout(() => (b.textContent = "复制批语"), 1500);
    });
  }

  /* ---------- 绑定 ---------- */
  buildEmperors();
  selectEmp(state.emp);
  $("#year").addEventListener("change", fillOffices);
  $("#office").addEventListener("change", () => { $(".custom-office").hidden = $("#office").value !== "custom"; });
  $("#doctype").addEventListener("change", docHint);
  $("#draftBtn").addEventListener("click", draft);
  $("#directBtn").addEventListener("click", direct);
  $("#redraftBtn").addEventListener("click", draft);
  $("#backBtn").addEventListener("click", showSetup);
  $("#submitBtn").addEventListener("click", submit);
  $("#retryBtn").addEventListener("click", () => { closeFlow(); submit(); });
  $("#cancelBtn").addEventListener("click", () => { closeFlow(); state.busy = false; });
  $("#editBtn").addEventListener("click", () => {
    const w = $("#editWrap");
    w.hidden = !w.hidden;
    if (!w.hidden) { $("#editText").value = state.body; $("#editText").focus(); }
  });
  $("#editText").addEventListener("input", (e) => { state.body = e.target.value; scheduleRender(); });
  $("#judou").addEventListener("change", () => $("#zhe").classList.toggle("nojudou", !$("#judou").checked));
  $("#againBtn").addEventListener("click", () => { showSetup(); $("#content").focus(); });
  $("#saveBtn").addEventListener("click", saveImage);
  $("#copyBtn").addEventListener("click", copyText);
})();
