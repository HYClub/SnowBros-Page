/* ===== 雪人兄弟 Snow Bros 演示页动画 ===== */
(() => {
  'use strict';

  const W = 960, HH = 400, GY = 312;   // 画布宽/高/地面顶
  const CHAR = { idle: 4, run: 6, fly: 6, throw: 4, dead: 1, hurt: 1, frozen: 1 };
  const FILE = { idle: 'idle', run: 'walk', fly: 'walk', throw: 'attack', dead: 'dead', hurt: 'hurt', frozen: 'frozen' };
  const CHARS = ['player', 'walker', 'flyer'];

  const img = {};  // img[char][state][i]
  const tileGround = new Image();
  const snowballImg = new Image();
  let ready = false;

  function loadAll() {
    const jobs = [];
    for (const c of CHARS) {
      img[c] = {};
      for (const st of Object.keys(CHAR)) {
        img[c][st] = [];
        const n = CHAR[st];
        for (let i = 0; i < n; i++) {
          const im = new Image();
          im.src = 'sprites/' + c + '/' + c + '_' + FILE[st] + '_' + i + '.png';
          img[c][st].push(im);
          jobs.push(new Promise(r => { im.onload = r; im.onerror = r; }));
        }
      }
    }
    tileGround.src = 'sprites/tiles/tile_ground.png';
    jobs.push(new Promise(r => { tileGround.onload = r; tileGround.onerror = r; }));
    snowballImg.src = 'sprites/items/snowball.png';
    jobs.push(new Promise(r => { snowballImg.onload = r; snowballImg.onerror = r; }));
    return Promise.all(jobs);
  }

  // ---------- 工具 ----------
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
  const rand = (a, b) => a + Math.random() * (b - a);
  function frame(arr, t, fps) {
    return arr[Math.floor(t * fps) % arr.length];
  }
  function drawChar(ctx, im, x, feetY, size, flip) {
    ctx.save();
    ctx.translate(x, feetY);
    if (flip < 0) ctx.scale(-1, 1);
    ctx.drawImage(im, 0, 0, 16, 16, -size / 2, -size, size, size);
    ctx.restore();
  }
  function shadow(ctx, x, y, w) {
    ctx.fillStyle = 'rgba(10,30,50,0.18)';
    ctx.beginPath();
    ctx.ellipse(x, y, w, w * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---------- 主画布实体 ----------
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const player = { x: W / 2, dir: 1, inv: 0, cd: 0, throwT: 0, anim: 0, flee: 0 };
  let walkers = [], flyers = [], projs = [], balls = [], fx = [];
  let kickTarget = null;
  let spawnT = 1.0, flySpawnT = 0.6;
  const snow = [];
  for (let i = 0; i < 46; i++) {
    snow.push({ x: Math.random() * W, y: Math.random() * HH, s: rand(1, 2.4), v: rand(18, 55), ph: rand(0, 6.28) });
  }
  function liveWalkers() { return walkers.filter(e => e.mode === 'patrol' || e.mode === 'chase'); }
  function makeWalker(side) {
    walkers.push({
      x: side > 0 ? -24 : W + 24, dir: side > 0 ? 1 : -1,
      mode: 'enter', snow: 0, anim: rand(0, 1), revT: rand(0.8, 2.4), spd: rand(42, 56)
    });
  }
  function spawnFlyer() {
    const side = Math.random() < 0.5 ? -1 : 1;
    flyers.push({ x: side > 0 ? -24 : W + 24, dir: side > 0 ? 1 : -1, ph: rand(0, 6.28), spd: rand(34, 48) });
  }
  function addFx(x, y, kind) { fx.push({ x, y, t: 0, kind: kind || 'puff' }); }

  function hurtPlayer(fromX) {
    if (player.inv > 0) return;
    player.inv = 1.25;
    player.flee = 0.8;
    player.dir = player.x < fromX ? -1 : 1;
    player.x += player.dir * 26;
    addFx(player.x, GY - 24, 'hit');
  }

  function kickFrozen() {
    const x = kickTarget.x;
    let dir = player.dir;
    let best = 1e9, bestD = 0;
    for (const e of liveWalkers()) {
      if (e === kickTarget) continue;
      const d = Math.abs(e.x - x);
      if (d < best) { best = d; bestD = e.x > x ? 1 : -1; }
    }
    if (best < 1e9) dir = bestD;
    balls.push({ x: x, dir: dir, ang: 0 });
    addFx(x, GY - 26, 'kick');
    kickTarget.mode = 'dead';
    kickTarget.deadT = 0;
    kickTarget = null;
    player.throwT = 0.28;
  }

  // ---------- 主循环 ----------
  function update(dt, t) {
    // 出生管理
    spawnT -= dt;
    if (spawnT <= 0) {
      const need = 3 - walkers.filter(e => e.mode !== 'dead').length;
      if (need > 0) {
        makeWalker(Math.random() < 0.5 ? 1 : -1);
        spawnT = rand(1.1, 2.2);
      } else spawnT = 0.6;
    }
    flySpawnT -= dt;
    if (flyers.length === 0 && flySpawnT <= 0) { spawnFlyer(); flySpawnT = rand(2, 3.5); }

    player.anim += dt;
    player.inv = Math.max(0, player.inv - dt);
    player.cd = Math.max(0, player.cd - dt);
    player.throwT = Math.max(0, player.throwT - dt);
    player.flee = Math.max(0, player.flee - dt);

    const lives = liveWalkers();

    // 玩家决策
    if (!kickTarget) kickTarget = walkers.find(e => e.mode === 'frozen') || null;

    if (kickTarget) {
      // 走过去踢
      const dx = kickTarget.x - player.x;
      player.dir = dx >= 0 ? 1 : -1;
      if (Math.abs(dx) > 24) player.x += player.dir * 82 * dt;
      else if (player.throwT <= 0) kickFrozen();
    } else if (lives.length) {
      // 最近的威胁
      let near = null, nd = 1e9;
      for (const e of lives) {
        const d = Math.abs(e.x - player.x);
        if (d < nd) { nd = d; near = e; }
      }
      const dx = near.x - player.x;
      if (nd < 46 && near.mode === 'chase' && player.inv <= 0) {
        hurtPlayer(near.x);
      } else if (player.flee > 0) {
        player.dir = player.x < near.x ? -1 : 1;
        player.x += player.dir * 92 * dt;
      } else if (nd < 150 && player.cd <= 0 && player.throwT <= 0) {
        player.dir = dx >= 0 ? 1 : -1;
        player.cd = 0.85;
        player.throwT = 0.3;
        projs.push({ x: player.x + player.dir * 26, y: GY - 36, dir: player.dir });
      } else if (nd > 130) {
        player.dir = dx >= 0 ? 1 : -1;
        player.x += player.dir * 52 * dt;
      } else {
        // 原地周旋,偶尔换向
        if (Math.random() < dt * 0.5) player.dir *= -1;
        player.x += player.dir * 14 * dt;
      }
    } else {
      if (Math.random() < dt * 0.4) player.dir *= -1;
      player.x += player.dir * 46 * dt;
    }
    // 边界
    if (player.x < 34) { player.x = 34; player.dir = 1; }
    if (player.x > W - 34) { player.x = W - 34; player.dir = -1; }

    // walker 更新
    for (const e of walkers) {
      e.anim += dt;
      if (e.mode === 'enter') {
        e.x += e.dir * 60 * dt;
        if (e.x > 30 && e.x < W - 30) {
          e.mode = Math.random() < 0.5 ? 'chase' : 'patrol';
          e.revT = rand(1, 2.6);
        }
      } else if (e.mode === 'patrol' || e.mode === 'chase') {
        e.revT -= dt;
        if (e.mode === 'patrol' && e.revT <= 0) { e.dir *= -1; e.revT = rand(1.2, 3); }
        const chase = e.mode === 'chase';
        if (chase) e.dir = player.x >= e.x ? 1 : -1;
        const spd = chase ? (e.spd + 30) : e.spd;
        e.x += e.dir * spd * dt;
        if (e.x < 26 || e.x > W - 26) {
          if (chase) { e.mode = 'patrol'; e.revT = rand(1, 2); }
          e.x = clamp(e.x, 26, W - 26); e.dir *= -1;
        }
      } else if (e.mode === 'frozen') {
        if (Math.random() < dt * 1.5) addFx(e.x + rand(-10, 10), GY - rand(6, 40), 'spark');
      } else if (e.mode === 'dead') {
        e.deadT += dt;
      }
    }
    walkers = walkers.filter(e => !(e.mode === 'dead' && e.deadT > 0.3));

    // flyer
    for (const f of flyers) {
      f.ph += dt;
      f.x += f.dir * f.spd * dt;
      if (f.x < 30 || f.x > W - 30) { f.x = clamp(f.x, 30, W - 30); f.dir *= -1; }
    }

    // 抛射物
    for (const p of projs) {
      p.x += p.dir * 190 * dt;
      for (const e of walkers) {
        if ((e.mode === 'patrol' || e.mode === 'chase') && Math.abs(e.x - p.x) < 26 && Math.abs(GY - p.y) < 34) {
          p.hit = true;
          e.snow++;
          addFx(e.x, GY - 24, 'spark');
          if (e.snow >= 3 && e.mode !== 'frozen') {
            e.mode = 'frozen';
            e.x = clamp(e.x, 40, W - 40);
            addFx(e.x, GY - 26, 'freeze');
          }
          break;
        }
      }
    }
    projs = projs.filter(p => !p.hit && p.x > 8 && p.x < W - 8);

    // 滚动雪球
    for (const b of balls) {
      b.x += b.dir * 245 * dt;
      b.ang += b.dir * 9 * dt;
      if (b.x < 24 || b.x > W - 24) {
        b.break = true;
        addFx(b.x, GY - 22, 'break');
      } else {
        for (const e of walkers) {
          if ((e.mode === 'patrol' || e.mode === 'chase') && Math.abs(e.x - b.x) < 34) {
            e.mode = 'dead'; e.deadT = 0;
            addFx(e.x, GY - 22, 'break');
            break;
          }
        }
      }
    }
    balls = balls.filter(b => !b.break);

    // 特效
    for (const f of fx) f.t += dt;
    fx = fx.filter(f => f.t < 0.5);

    // 雪花
    for (const s of snow) {
      s.y += s.v * dt;
      s.x += Math.sin(t * 0.9 + s.ph) * 10 * dt;
      if (s.y > HH) { s.y = -4; s.x = Math.random() * W; }
    }
  }

  function draw(t) {
    // 天空
    const sky = ctx.createLinearGradient(0, 0, 0, GY + 60);
    sky.addColorStop(0, '#6aa7d8');
    sky.addColorStop(0.45, '#bfe3f7');
    sky.addColorStop(0.78, '#eaf6fd');
    sky.addColorStop(1, '#d5e4ee');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, HH);
    // 远山
    ctx.fillStyle = 'rgba(200,225,240,0.55)';
    ctx.beginPath();
    ctx.moveTo(0, GY);
    for (let x = 0; x <= W; x += 24) {
      const y = GY - 20 - Math.abs(Math.sin(x * 0.006 + 1.2)) * 52;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, GY); ctx.closePath(); ctx.fill();
    // 地面
    ctx.fillStyle = '#b8d2e2';
    ctx.fillRect(0, GY, W, HH - GY);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(0, GY, W, 6);
    for (let ty = GY + 6; ty < HH; ty += 32) {
      for (let tx = 0; tx < W; tx += 32) {
        ctx.globalAlpha = 0.55;
        ctx.drawImage(tileGround, tx, ty, 32, 32);
      }
    }
    ctx.globalAlpha = 1;

    // 角色阴影
    for (const e of walkers) if (e.mode !== 'dead') shadow(ctx, e.x, GY + 2, 20);
    if (player.inv <= 0 || Math.floor(t * 10) % 2 === 0) shadow(ctx, player.x, GY + 2, 20);

    // 玩家
    if (player.inv > 0 && Math.floor(t * 14) % 2 === 0) {
      drawChar(ctx, img.player.hurt[0], player.x, GY, 48, player.dir);
    } else if (player.throwT > 0) {
      drawChar(ctx, frame(img.player.throw, (0.3 - player.throwT), 11), player.x, GY, 48, player.dir);
    } else {
      drawChar(ctx, frame(img.player.run, t, 8), player.x, GY, 48, player.dir);
    }
    // walker
    for (const e of walkers) {
      if (e.mode === 'dead') continue;
      const im = e.mode === 'frozen'
        ? frame(img.walker.frozen, t, 2)
        : frame(img.walker.run, e.anim, e.mode === 'enter' ? 8 : 7);
      drawChar(ctx, im, e.x, GY, 48, e.dir);
    }
    // 抛射物
    for (const p of projs) {
      drawChar(ctx, snowballImg, p.x, p.y, 22, p.dir);
    }
    // 滚动雪球
    for (const b of balls) {
      ctx.save();
      ctx.translate(b.x, GY - 26);
      ctx.rotate(b.ang);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(snowballImg, 0, 0, 16, 16, -26, -26, 52, 52);
      ctx.restore();
    }
    // flyer
    for (const f of flyers) {
      const y = GY - 95 + Math.sin(f.ph * 1.7) * 14;
      drawChar(ctx, frame(img.flyer.fly, t + f.ph, 9), f.x, y, 48, f.dir);
    }

    // 特效
    for (const f of fx) {
      const k = f.t / 0.5;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = f.kind === 'spark' ? '#bfe9ff' : '#ffffff';
      const r = f.kind === 'freeze' ? 6 + k * 16 : 4 + k * 13;
      ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // 雪花
    for (const s of snow) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---------- 图鉴预览 ----------
  function runPreview(cv) {
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    const start = performance.now() / 1000;
    const ch = cv.dataset.char, st = cv.dataset.state;
    const framesArr = img[ch][st];
    const cw = cv.width, chh = cv.height;
    const gy = chh - 26;
    function tick(now) {
      const t = (now / 1000) - start;
      c.clearRect(0, 0, cw, chh);
      const g = c.createLinearGradient(0, 0, 0, chh);
      g.addColorStop(0, '#bfe3f7'); g.addColorStop(1, '#cfe2ee');
      c.fillStyle = g; c.fillRect(0, 0, cw, chh);
      c.fillStyle = '#c3dbe9'; c.fillRect(0, gy, cw, chh - gy);
      c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(0, gy, cw, 3);
      for (let tx = 0; tx < cw; tx += 32) c.drawImage(tileGround, tx, gy + 3, 32, 32);
      const x = cw / 2 + Math.sin(t * 1.1) * cw * 0.22;
      let y = gy, flip = 1, im = frame(framesArr, t, 8);
      if (st === 'fly') {
        y = chh * 0.42 + Math.sin(t * 2.2) * 10;
        x = cw / 2 + Math.sin(t * 0.9) * cw * 0.24;
        flip = Math.sin(t * 0.9 + Math.PI / 2) >= 0 ? 1 : -1;
        im = frame(framesArr, t + Math.sin(t), 9);
      } else {
        flip = Math.cos(t * 1.1) >= 0 ? 1 : -1;
      }
      drawChar(c, im, x, y, 48, flip);
      shadow(c, x, y + 2, 20);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ---------- 启动 ----------
  loadAll().then(() => {
    ready = true;
    for (const e of document.querySelectorAll('.preview')) runPreview(e);
    makeWalker(-1); makeWalker(1); spawnT = rand(1.6, 2.6);
    let last = performance.now();
    let t = 0;
    function loop(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now; t += dt;
      update(dt, t);
      draw(t);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  });
})();
