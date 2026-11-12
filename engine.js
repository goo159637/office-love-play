/* 오피스 러브 — 간단한 비주얼 노벨 엔진 */
(() => {
  const S = window.STORY, A = window.ASSETS;
  const $ = (q, r = document) => r.querySelector(q);
  const stage = $('#stage'), box = $('#box'), nameEl = $('#name'), textEl = $('#text'), nextEl = $('#next');
  const CH = {
    harin: { n: '하린', c: 'var(--harin)' }, jia: { n: '지아', c: 'var(--jia)' },
    yujin: { n: '유진', c: 'var(--yujin)' }, sori: { n: '소리', c: 'var(--sori)' },
    yerin: { n: '예린', c: 'var(--yerin)' },
    chaewon: { n: '채원', c: 'var(--chaewon)' },
  };
  const POS = { left: 0.24, center: 0.5, right: 0.76 };
  const SAVE_KEY = 'officelove_save_';
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  };

  /* ---------- layout ---------- */
  // 해상도: 'auto' = 창에 맞춤, 그 외 '가로x세로' 고정 (창보다 크면 창에 맞춰 줄임)
  const RES = ['auto', '1280x720', '1366x768', '1600x900', '1920x1080', '2560x1440', '3840x2160'];
  let res = RES.includes(store.get('officelove_res')) ? store.get('officelove_res') : 'auto';
  function fit() {
    let s = Math.min(innerWidth / 1920, innerHeight / 1080);
    if (res !== 'auto') { const [w, h] = res.split('x').map(Number); s = Math.min(s, w / 1920, h / 1080); }
    stage.style.setProperty('--s', s);
  }
  addEventListener('resize', fit); fit();

  /* ---------- state ---------- */
  let st = null;            // 저장되는 상태
  let typing = null, waiting = false, inChoice = false, auto = false, skip = false, autoTimer = null;
  const fresh = (name) => ({
    name, scene: S.start, idx: 0, bg: null, cg: null, chars: {},
    aff: { harin: 0, jia: 0, yujin: 0, sori: 0, yerin: 0, chaewon: 0 }, outfit: {}, log: [],
  });
  const fill = (s) => s.replaceAll('{주인공}', st.name);

  /* ---------- backgrounds ---------- */
  const bgLayer = $('#bgs');
  function setBg(id, instant) {
    st.bg = id;
    const url = A.bgs[id];
    const old = [...bgLayer.children];
    const d = document.createElement('div');
    d.className = 'bg'; d.style.backgroundImage = url ? `url("${url}")` : 'none';
    if (!url) d.style.background = '#c9b8c8';
    bgLayer.appendChild(d);
    const on = () => { d.classList.add('on'); setTimeout(() => old.forEach(o => o.remove()), 800); };
    instant ? (d.style.transition = 'none', on()) : requestAnimationFrame(() => requestAnimationFrame(on));
  }

  /* ---------- characters ---------- */
  const charLayer = $('#chars');
  const els = {};
  // 의상: 대본의 @옷 이 우선, 없으면 호감도 65%(13/20) 이상일 때 '호감 룩'(crush)
  const AFF_MAX = 20, CRUSH_AT = 13, ROUTE_MIN = 8;
  function outfitOf(c) {
    const a = A.chars[c], o = st?.outfit?.[c];
    if (o && a.outfits[o]) return o;
    if (st && st.aff[c] >= CRUSH_AT && a.outfits.crush) return 'crush';
    return 'office';
  }
  function sprite(c, e, outfit) {
    const o = A.chars[c].outfits[outfit || outfitOf(c)];
    return o.exprs[e] || o.exprs[A.chars[c].def] || Object.values(o.exprs)[0];
  }
  function refreshOutfit(c) {
    const el = els[c]; if (!el || !st.chars[c]) return;
    placeChar(el, c, st.chars[c].p); setExpr(c, st.chars[c].e, true);
  }
  function placeChar(el, c, p) {
    const a = A.chars[c];
    const h = a.h, w = h * a.outfits[outfitOf(c)].ar;
    el.style.width = w + 'px'; el.style.height = h + 'px';
    el.style.bottom = a.y + 'px';
    el.style.left = (POS[p] ?? 0.5) * 1920 + 'px';
  }
  function showChar(c, e, p, instant) {
    st.chars[c] = { e, p };
    let el = els[c];
    if (!el) {
      el = els[c] = document.createElement('div');
      el.className = 'char';
      const img = new Image(); img.alt = CH[c]?.n || c; img.src = sprite(c, e);
      el.appendChild(img); charLayer.appendChild(el);
      placeChar(el, c, p);
      if (instant) el.style.transition = 'none';
      requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add('on'); el.style.transition = ''; }));
    } else {
      placeChar(el, c, p); setExpr(c, e); el.classList.add('on');
    }
  }
  function setExpr(c, e, force) {
    if (!st.chars[c]) return;
    st.chars[c].e = e;
    const el = els[c]; if (!el) return;
    const src = sprite(c, e);
    const cur = el.querySelector('img:last-child');
    if (cur && cur.getAttribute('src') === src) return;
    const img = new Image(); img.alt = CH[c]?.n || c; img.src = src; img.className = 'out';
    el.appendChild(img);
    const swap = () => { img.classList.remove('out'); setTimeout(() => [...el.querySelectorAll('img')].slice(0, -1).forEach(i => i.remove()), 250); };
    img.complete ? requestAnimationFrame(swap) : (img.onload = swap, img.onerror = swap);
  }
  function hideChar(c) {
    delete st.chars[c];
    const el = els[c]; if (!el) return;
    delete els[c];
    el.classList.remove('on'); setTimeout(() => el.remove(), 450);
  }
  function focus(who) {
    for (const [c, el] of Object.entries(els)) el.classList.toggle('dim', !!who && who !== c && who in CH);
  }

  /* ---------- CG ---------- */
  const cg = $('#cg'), cgImg = $('#cg img');
  function setCg(id) {
    st.cg = id;
    if (id && !A.cgs[id]) { st.cg = null; return; } // 아직 이미지가 없는 CG는 건너뜀
    if (id) { cgImg.src = A.cgs[id]; cg.classList.add('on'); }
    else cg.classList.remove('on');
  }

  /* ---------- text ---------- */
  function say(cmd) {
    const text = fill(cmd.text);
    let who = cmd.who, label = null, color = null;
    textEl.className = '';
    if (who === 'narr') textEl.classList.add('narr');
    else if (who === 'thought') textEl.classList.add('thought');
    else if (who === 'me') { label = st.name; color = 'var(--me)'; }
    else if (CH[who]) { label = CH[who].n; color = CH[who].c; if (cmd.e) setExpr(who, cmd.e); }
    else { label = who; color = 'var(--me)'; }
    if (label) { nameEl.textContent = label; nameEl.style.background = color; nameEl.classList.remove('none'); }
    else nameEl.classList.add('none');
    focus(CH[who] ? who : null);
    const shown = who === 'thought' ? `(${text})` : text;
    st.log.push({ who: label || (who === 'thought' ? '속마음' : ''), text: shown, c: color });
    if (st.log.length > 200) st.log.shift();
    box.classList.remove('hide');
    typeOut(shown);
  }
  function typeOut(s) {
    clearInterval(typing?.t);
    nextEl.classList.remove('on');
    textEl.textContent = '';
    let i = 0;
    const speed = skip ? 0 : 28;
    if (!speed) { textEl.textContent = s; doneTyping(); return; }
    typing = { s, t: setInterval(() => {
      i++; textEl.textContent = s.slice(0, i);
      if (i >= s.length) doneTyping();
    }, speed) };
  }
  function doneTyping() {
    clearInterval(typing?.t); typing = null;
    nextEl.classList.add('on'); waiting = true;
    clearTimeout(autoTimer);
    if (skip) autoTimer = setTimeout(advance, 70);
    else if (auto) {
      autoTimer = setTimeout(advance, 1200 + textEl.textContent.length * 45);
    }
  }
  function advance() {
    if (inChoice) return;
    if (typing) { textEl.textContent = typing.s; doneTyping(); return; }
    if (!waiting) return;
    waiting = false; run();
  }

  /* ---------- choices ---------- */
  const chBox = $('#choices');
  function choose(cmd) {
    inChoice = true; stopModes(); const shownAt = performance.now();
    chBox.innerHTML = '';
    cmd.opts.forEach(o => {
      const b = document.createElement('button');
      b.textContent = fill(o.text);
      b.onclick = (ev) => {
        ev.stopPropagation();
        if (performance.now() - shownAt < 400) return; // 연타로 잘못 고르는 것 방지
        inChoice = false; chBox.classList.remove('on');
        st.log.push({ who: '▶ 선택', text: fill(o.text), c: 'var(--accent)' });
        for (const [c, v] of Object.entries(o.fx)) { st.aff[c] += v; if (v) toast(c, v); refreshOutfit(c); }
        go(o.next);
      };
      chBox.appendChild(b);
    });
    chBox.classList.add('on');
    chBox.querySelector('button')?.focus({ preventScroll: true });
  }
  function toast(c, v) {
    const t = document.createElement('div'); t.className = 't';
    t.innerHTML = `<span style="color:${CH[c].c}">${CH[c].n}</span> ${v > 0 ? '♥ +' + v : '↓ ' + v}`;
    $('#toast').appendChild(t); setTimeout(() => t.remove(), 2300);
  }

  /* ---------- runner ---------- */
  function go(scene) {
    if (!S.scenes[scene]) return theEnd();
    st.scene = scene; st.idx = 0; run();
  }
  function run() {
    for (;;) {
      const list = S.scenes[st.scene];
      if (!list) return theEnd();
      if (st.idx >= list.length) {
        const i = S.order.indexOf(st.scene);
        const nx = S.order[i + 1];
        if (!nx) return theEnd();
        st.scene = nx; st.idx = 0; continue;
      }
      const cmd = list[st.idx];
      st.cur = st.idx; st.idx++;
      switch (cmd.t) {
        case 'bg': for (const c of Object.keys(st.chars)) hideChar(c); setBg(cmd.id); break;
        case 'show': showChar(cmd.c, cmd.e, cmd.p); break;
        case 'hide': hideChar(cmd.c); break;
        case 'outfit': st.outfit = st.outfit || {}; if (cmd.o) st.outfit[cmd.c] = cmd.o; else delete st.outfit[cmd.c]; refreshOutfit(cmd.c); break;
        case 'cg': setCg(cmd.id); break;
        case 'cgend': setCg(null); break;
        case 'say': say(cmd); return;
        case 'choice': st.idx = st.cur; box.classList.remove('hide'); return choose(cmd);
        case 'goto': return go(cmd.next);
        case 'if': {
          const v = st.aff[cmd.c] ?? 0;
          const ok = { '>=': v >= cmd.n, '<=': v <= cmd.n, '>': v > cmd.n, '<': v < cmd.n }[cmd.op];
          return go(ok ? cmd.yes : cmd.no);
        }
        case 'pick': st.pick = cmd.c; break;
        case 'flag': (st.flags = st.flags || {})[cmd.f] = true; break;
        case 'aff': st.aff[cmd.c] = (st.aff[cmd.c] || 0) + cmd.v; if (cmd.v) toast(cmd.c, cmd.v); refreshOutfit(cmd.c); break;
        case 'iff': return go(st.flags?.[cmd.f] ? cmd.yes : cmd.no);
        case 'route': {
          // 루트 분기: 최고 호감도 캐릭터 (동점이면 회식 2차에서 고른 사람), 8 미만이면 배드 엔딩
          const max = Math.max(...Object.values(st.aff));
          if (max < ROUTE_MIN) return go('ending_bad');
          const tops = Object.keys(st.aff).filter(c => st.aff[c] === max);
          st.route = tops.includes(st.pick) ? st.pick : tops[0];
          return go(`route_${st.route}_01`);
        }
        case 'ending': st.ending = { id: cmd.id, kind: cmd.kind, name: cmd.name }; return theEnd();
      }
    }
  }

  /* ---------- modes ---------- */
  const bar = $('#bar');
  function stopModes() { auto = skip = false; clearTimeout(autoTimer); paintBar(); }
  function paintBar() {
    bar.querySelector('[data-a=auto]').classList.toggle('act', auto);
    bar.querySelector('[data-a=skip]').classList.toggle('act', skip);
  }
  bar.addEventListener('click', (e) => {
    e.stopPropagation();
    const a = e.target.dataset.a; if (!a) return;
    if (a === 'auto') { auto = !auto; skip = false; paintBar(); if (auto && waiting) advance(); }
    if (a === 'skip') { skip = !skip; auto = false; paintBar(); if (skip && (waiting || typing)) advance(); }
    if (a === 'log') openLog();
    if (a === 'aff') openAff($('#affList'));
    if (a === 'save') openSlots('save');
    if (a === 'load') openSlots('load');
    if (a === 'title') ask('타이틀로 돌아갈까요?<br>저장하지 않은 진행은 사라져요.', toTitle);
  });

  /* ---------- modals ---------- */
  // 브라우저 기본 팝업(confirm/alert)은 막힌 환경이 있어서 게임 안 확인창을 씀
  function ask(msg, onYes) {
    stopModes(); $('#askMsg').innerHTML = msg;
    $('#askNo').style.display = onYes ? '' : 'none';
    $('#askYes').onclick = (e) => { e.stopPropagation(); $('#m-ask').classList.remove('on'); onYes && onYes(); };
    $('#askNo').onclick = (e) => { e.stopPropagation(); $('#m-ask').classList.remove('on'); };
    $('#m-ask').classList.add('on');
  }
  const open = (id) => { stopModes(); $(id).classList.add('on'); };
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = (e) => { e.stopPropagation(); b.closest('.screen').classList.remove('on'); });
  function openLog() {
    $('#log').innerHTML = st.log.map(l => `<div class="entry">${l.who ? `<span class="who" style="color:${l.c || 'inherit'}">${esc(l.who)}</span>` : ''}${esc(l.text)}</div>`).join('');
    open('#m-log');
    const p = $('#m-log .panel'); p.scrollTop = p.scrollHeight;
  }
  function openAff(el) {
    el.innerHTML = Object.keys(CH).map(c => {
      const v = st.aff[c], pct = Math.max(0, Math.min(100, v / AFF_MAX * 100));
      return `<div class="aff"><b style="color:${CH[c].c}">${CH[c].n}</b><div class="barbg"><div class="fill" style="width:${pct}%;background:${CH[c].c}"></div></div><span>${v} / ${AFF_MAX}${v >= AFF_MAX ? ' <b style="font-size:.8em;color:#fff;background:' + CH[c].c + ';padding:2px 10px;border-radius:999px">MAX</b>' : ''}</span></div>`;
    }).join('') + `<div class="affmax">호감도 MAX = ${AFF_MAX} · ${CRUSH_AT} 이상이면 룩이 바뀌고, ${AFF_MAX}(MAX)로 고백하면 특별한 장면이 있어요</div>`;
    if (el.id === 'affList') open('#m-aff');
  }
  function openSlots(mode) {
    $('#slotsTitle').textContent = mode === 'save' ? '저장' : '불러오기';
    const list = $('#slotList'); list.innerHTML = '';
    for (let i = 1; i <= 3; i++) {
      const d = store.get(SAVE_KEY + i);
      const row = document.createElement('div'); row.className = 'slot';
      row.innerHTML = `<div><b>슬롯 ${i}</b><div class="info">${d ? esc(d.when + ' · ' + d.preview) : '비어 있음'}</div></div>`;
      const b = document.createElement('button'); b.className = 'btn';
      b.textContent = mode === 'save' ? '저장' : '불러오기';
      b.disabled = mode === 'load' && !d;
      if (b.disabled) b.style.opacity = .4;
      b.onclick = (e) => {
        e.stopPropagation();
        if (mode === 'save') {
          const snap = JSON.parse(JSON.stringify(st)); snap.idx = st.cur;
          const ok = store.set(SAVE_KEY + i, { st: snap, when: new Date().toLocaleString('ko-KR'), preview: textEl.textContent.slice(0, 24) });
          ok ? openSlots('save') : ask('이 브라우저에서는 저장을 쓸 수 없어요.', null);
        } else { $('#m-slots').classList.remove('on'); loadState(d.st); }
      };
      row.appendChild(b); list.appendChild(row);
    }
    open('#m-slots');
  }
  function loadState(snap) {
    $('#title').classList.remove('on'); $('#end').classList.remove('on');
    resetStage(); st = snap;
    if (st.bg) setBg(st.bg, true);
    for (const [c, v] of Object.entries(st.chars)) showChar(c, v.e, v.p, true);
    setCg(st.cg);
    bar.style.display = 'flex';
    run();
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

  /* ---------- flow ---------- */
  function resetStage() {
    stopModes(); clearInterval(typing?.t); typing = null; waiting = false; inChoice = false;
    bgLayer.innerHTML = ''; charLayer.innerHTML = ''; for (const k in els) delete els[k];
    cg.classList.remove('on'); chBox.classList.remove('on'); box.classList.add('hide');
  }
  function toTitle() {
    resetStage(); bar.style.display = 'none';
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
    $('#title').classList.add('on');
  }
  function theEnd() {
    stopModes(); box.classList.add('hide');
    const tmp = $('#endAff'); openAff(tmp);
    const h = $('#endHead'), m = $('#endMsg');
    if (st.ending) {
      h.textContent = st.ending.id === 'bad' ? 'BAD END' : `${CH[st.ending.id].n} ${st.ending.kind.toUpperCase()} END`;
      m.innerHTML = `「${esc(st.ending.name)}」<br>플레이해 주셔서 고마워요.`;
    } else if (st.route) {
      h.textContent = `${CH[st.route].n} 루트 진입!`;
      const nm = CH[st.route].n, code = nm.charCodeAt(nm.length - 1) - 0xac00;
      const josa = code >= 0 && code % 28 ? '과' : '와';
      m.innerHTML = `${nm}${josa}의 이야기가 시작됐어요.<br>개별 루트는 준비 중이에요.`;
    } else { h.textContent = '데모 끝!'; m.innerHTML = '다음 이야기는 준비 중이에요.'; }
    $('#end').classList.add('on');
  }
  $('#endTitle').onclick = (e) => { e.stopPropagation(); toTitle(); };
  $('#title').addEventListener('click', (e) => {
    const t = e.target.dataset.t; if (!t) return; e.stopPropagation();
    if (t === 'new') { $('#m-name').classList.add('on'); setTimeout(() => $('#nameIn').select(), 50); }
    if (t === 'load') { st = st || fresh('이준호'); openSlots('load'); }
    if (t === 'set') openSettings();
  });
  const RES_NAME = { auto: '창에 맞춤', '1280x720': 'HD', '1366x768': '노트북', '1600x900': 'HD+', '1920x1080': 'FHD', '2560x1440': 'QHD', '3840x2160': '4K' };
  function openSettings() {
    $('#resList').innerHTML = RES.map(r => `<button class="btn res${r === res ? ' act' : ''}" data-res="${r}">${r === 'auto' ? '창에 맞춤' : r.replace('x', ' × ')}<small>${r === 'auto' ? '자동' : RES_NAME[r]}</small></button>`).join('');
    $('#winSize').textContent = `지금 창 크기: ${innerWidth} × ${innerHeight}` + (res !== 'auto' && Math.min(innerWidth / +res.split('x')[0], innerHeight / +res.split('x')[1]) < 1 ? ' · 창이 더 작아서 창 크기에 맞춰 보여요' : '');
    $('#fsBtn').textContent = document.fullscreenElement ? '전체 화면 끄기' : '전체 화면';
    $('#m-set').classList.add('on');
  }
  $('#resList').addEventListener('click', (e) => {
    e.stopPropagation();
    const b = e.target.closest('[data-res]'); if (!b) return;
    res = b.dataset.res; store.set('officelove_res', res); fit(); openSettings();
  });
  $('#fsBtn').onclick = (e) => {
    e.stopPropagation();
    const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
    Promise.resolve(p).catch(() => {}).finally(() => setTimeout(openSettings, 300));
  };
  addEventListener('resize', () => { if ($('#m-set').classList.contains('on')) openSettings(); });
  function startNew() {
    const n = $('#nameIn').value.trim() || '이준호';
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
    resetStage(); st = fresh(n); bar.style.display = 'flex'; run();
  }
  $('#nameOk').onclick = (e) => { e.stopPropagation(); startNew(); };
  $('#nameIn').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') startNew(); });

  // 진행 입력
  stage.addEventListener('click', (e) => {
    if (e.target.closest('.screen,#bar,#choices button')) return;
    if (!st || $('#title').classList.contains('on')) return;
    if (skip || auto) { stopModes(); }
    advance();
  });
  addEventListener('keydown', (e) => {
    if (document.querySelector('.screen.on')) { if (e.key === 'Escape') document.querySelectorAll('.modal.on').forEach(m => m.id !== 'end' && m.classList.remove('on')); return; }
    if (!st) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!inChoice) advance(); }
  });

  // 타이틀 표지: 캐릭터마다 사선 컬러 패널에 상반신 크게
  const COVER = [
    ['harin', '#ffe3c2', '#ffd3a6', 70], ['jia', '#e4e0ff', '#d3cdfb', 0], ['yujin', '#dbe7fb', '#c6d8f6', 0],
    ['chaewon', '#f4e6d8', '#ead6c2', 0], ['sori', '#d9f3e5', '#c4ead6', 0], ['yerin', '#ffdbe0', '#ffc7cf', 40],
  ];
  const tp = $('#title .panels');
  COVER.forEach(([c, c1, c2, dx]) => {
    const p = document.createElement('div'); p.className = 'tp';
    p.innerHTML = `<div class="bgp" style="--c1:${c1};--c2:${c2}"></div>`;
    // 표지 전용 고해상도 상반신 (tools/build_cover.py). 게임 스프라이트를 키우면 흐릿해짐
    const img = new Image(); img.src = `assets/cover_${c}.webp`; img.alt = '';
    img.onerror = () => { img.onerror = null; img.src = sprite(c, A.chars[c].def); img.style.height = c === 'yerin' ? '2430px' : '1800px'; };
    // 상반신이 패널을 채우게 확대 (예린은 전신 그림이라 더 크게) — 원래 스프라이트 높이 1800/2430 의 윗부분 62%/47%
    img.style.height = c === 'yerin' ? (2430 * 0.47) + 'px' : (1800 * 0.62) + 'px';
    img.style.top = c === 'yerin' ? '60px' : '30px';
    img.style.marginLeft = dx + 'px';
    p.appendChild(img); tp.appendChild(p);
  });
  // 이미지 미리 불러오기
  setTimeout(() => {
    const urls = [...Object.values(A.bgs), ...Object.values(A.cgs), ...Object.values(A.chars).flatMap(c => Object.values(c.outfits).flatMap(o => Object.values(o.exprs)))];
    urls.forEach(u => { const i = new Image(); i.src = u; });
  }, 300);
})();
