// Shared procedural drafting helpers for the Step 0 boards.
// Everything is generated from numbers so the same seed always draws the same sheet.
(function () {
  const C = {
    blue: '#1E3F66',
    line: '#F5F7F2',
    vellum: '#EDEBE3',
    red: '#D2412F',
    graphite: '#5A5A5A',
  };

  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const f = (n) => Math.round(n * 10) / 10;

  // Scalloped revision cloud around a box, traced on a superellipse so it reads hand-drawn.
  function cloudPath(x, y, w, h, { r = 13, seed = 7, pad = 10 } = {}) {
    const rand = rng(seed);
    const cx = x + w / 2, cy = y + h / 2;
    const a = w / 2 + pad, b = h / 2 + pad;
    const n = 5;
    const samples = [];
    for (let i = 0; i < 720; i++) {
      const t = (i / 720) * Math.PI * 2;
      const c = Math.cos(t), s = Math.sin(t);
      samples.push([
        cx + a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n),
        cy + b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n),
      ]);
    }
    let per = 0;
    for (let i = 1; i < samples.length; i++) per += Math.hypot(samples[i][0] - samples[i - 1][0], samples[i][1] - samples[i - 1][1]);
    const count = Math.max(8, Math.round(per / (r * 1.7)));
    const pts = [];
    let acc = 0, next = 0, k = 0;
    for (let i = 1; i < samples.length && k < count; i++) {
      const d = Math.hypot(samples[i][0] - samples[i - 1][0], samples[i][1] - samples[i - 1][1]);
      acc += d;
      if (acc >= next) {
        pts.push(samples[i]);
        k++;
        next = (per / count) * k * (0.92 + rand() * 0.16);
      }
    }
    let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
    for (let i = 1; i <= pts.length; i++) {
      const p = pts[i % pts.length], q = pts[i - 1];
      const chord = Math.hypot(p[0] - q[0], p[1] - q[1]);
      const rr = chord * (0.55 + rand() * 0.12);
      d += ` A${f(rr)},${f(rr)} 0 0 1 ${f(p[0])},${f(p[1])}`;
    }
    return d;
  }

  // Revision delta: triangle with the revision letter, as on real drawings.
  function delta(x, y, letter, ink = C.red, size = 22) {
    const h = size * 0.87;
    return `<g class="delta"><path d="M${x},${y - h * 0.62} L${x + size / 2},${y + h * 0.38} L${x - size / 2},${y + h * 0.38} Z" fill="none" stroke="${ink}" stroke-width="1.6"/>
      <text x="${x}" y="${y + h * 0.26}" text-anchor="middle" class="lbl" font-size="${size * 0.55}" fill="${ink}" font-weight="600">${letter}</text></g>`;
  }

  // Plan-oblique box: footprint on the ground, extruded straight up by floors.
  function building(x, y, w, d, floors, { ink = C.line, fh = 9, dash = '', label = '', sub = '', fill = 'none', sw = 1.3, labelBelow = true } = {}) {
    const H = floors * fh;
    const da = dash ? `stroke-dasharray="${dash}"` : '';
    let g = `<g class="bldg" stroke="${ink}" stroke-width="${sw}" fill="none" ${da}>`;
    // ground footprint (hidden line where covered)
    g += `<rect x="${x}" y="${y}" width="${w}" height="${d}" stroke-opacity=".35" stroke-dasharray="3 3"/>`;
    // front face
    g += `<rect x="${x}" y="${y + d - H}" width="${w}" height="${H}" fill="${fill}"/>`;
    // roof
    g += `<rect x="${x}" y="${y - H}" width="${w}" height="${d}" fill="${fill}"/>`;
    // floor lines on the front face
    for (let i = 1; i < floors; i++) g += `<line x1="${x}" y1="${y + d - i * fh}" x2="${x + w}" y2="${y + d - i * fh}" stroke-opacity=".55" stroke-width=".8"/>`;
    // roof parapet + plant
    g += `<rect x="${x + 6}" y="${y - H + 6}" width="${w - 12}" height="${d - 12}" stroke-opacity=".5" stroke-width=".7"/>`;
    g += `<rect x="${x + w * 0.62}" y="${y - H + d * 0.22}" width="${w * 0.2}" height="${d * 0.22}" stroke-opacity=".6" stroke-width=".7"/>`;
    g += `</g>`;
    if (label) {
      const ly = labelBelow ? y + d + 18 : y - H - 10;
      g += `<text x="${x}" y="${ly}" class="lbl" fill="${ink}" font-size="15">${label}</text>`;
      if (sub) g += `<text x="${x}" y="${ly + 14}" class="mono" fill="${ink}" fill-opacity=".72" font-size="10">${sub}</text>`;
    }
    return g;
  }

  // Database as a water reservoir: basin outline with level hatching.
  function reservoir(cx, cy, rx, ry, { ink = C.line, level = 0.6, dash = '', label = '', sub = '' } = {}) {
    const da = dash ? `stroke-dasharray="${dash}"` : '';
    let g = `<g stroke="${ink}" fill="none" ${da}>`;
    g += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" stroke-width="1.4"/>`;
    g += `<ellipse cx="${cx}" cy="${cy}" rx="${rx - 6}" ry="${ry - 5}" stroke-width=".7" stroke-opacity=".6"/>`;
    const rows = Math.round(level * 6);
    for (let i = 0; i < rows; i++) {
      const yy = cy + ry - 9 - i * ((ry * 2 - 14) / 6);
      const half = rx * Math.sqrt(Math.max(0, 1 - Math.pow((yy - cy) / ry, 2))) - 12;
      if (half < 8) continue;
      let p = `M${f(cx - half)},${f(yy)}`;
      const steps = Math.floor((half * 2) / 10);
      for (let s = 0; s < steps; s++) p += ` q2.5,-2.5 5,0 t5,0`;
      g += `<path d="${p}" stroke-width=".7" stroke-opacity=".7"/>`;
    }
    g += `</g>`;
    if (label) {
      g += `<text x="${cx}" y="${cy + ry + 18}" text-anchor="middle" class="lbl" fill="${ink}" font-size="15">${label}</text>`;
      if (sub) g += `<text x="${cx}" y="${cy + ry + 32}" text-anchor="middle" class="mono" fill="${ink}" fill-opacity=".72" font-size="10">${sub}</text>`;
    }
    return g;
  }

  // API as a road: two kerb lines and a dashed centre line along a polyline.
  function road(points, { ink = C.line, width = 14, dash = '', opacity = 1 } = {}) {
    const p = points.map((q) => q.join(',')).join(' ');
    const da = dash ? `stroke-dasharray="${dash}"` : '';
    return `<g fill="none" stroke-linejoin="miter" opacity="${opacity}" ${da}>
      <polyline points="${p}" stroke="${ink}" stroke-width="${width}"/>
      <polyline points="${p}" stroke="var(--ground)" stroke-width="${width - 2.6}"/>
      <polyline points="${p}" stroke="${ink}" stroke-width=".8" stroke-dasharray="6 6" stroke-opacity=".6"/>
    </g>`;
  }

  // Queue as a rail line: two rails with crossties.
  function rail(x1, y1, x2, y2, { ink = C.line, dash = '' } = {}) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    const nx = -uy * 5, ny = ux * 5;
    const da = dash ? `stroke-dasharray="${dash}"` : '';
    let g = `<g stroke="${ink}" fill="none" ${da}>`;
    g += `<line x1="${x1 + nx}" y1="${y1 + ny}" x2="${x2 + nx}" y2="${y2 + ny}" stroke-width="1"/>`;
    g += `<line x1="${x1 - nx}" y1="${y1 - ny}" x2="${x2 - nx}" y2="${y2 - ny}" stroke-width="1"/>`;
    for (let s = 6; s < len; s += 9) {
      const px = x1 + ux * s, py = y1 + uy * s;
      g += `<line x1="${px + nx * 1.6}" y1="${py + ny * 1.6}" x2="${px - nx * 1.6}" y2="${py - ny * 1.6}" stroke-width=".8" stroke-opacity=".7"/>`;
    }
    return g + `</g>`;
  }

  // Module boundary as a property line (long dash, two short dashes).
  function district(points, { ink = C.line, label = '', lx = 0, ly = 0, dash = '18 5 3 5 3 5' } = {}) {
    const p = points.map((q) => q.join(',')).join(' ');
    let g = `<polygon points="${p}" fill="none" stroke="${ink}" stroke-width="1.1" stroke-dasharray="${dash}" stroke-opacity=".85"/>`;
    if (label) g += `<text x="${lx}" y="${ly}" class="lbl spaced" fill="${ink}" fill-opacity=".85" font-size="12">${label}</text>`;
    return g;
  }

  // Traffic particles placed deterministically along a polyline.
  function particles(points, n, { ink = C.line, seed = 3, r = 1.6, spread = 4, stress = 0 } = {}) {
    const rand = rng(seed);
    const segs = [];
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      const l = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
      segs.push([points[i - 1], points[i], l]);
      total += l;
    }
    let g = '';
    for (let i = 0; i < n; i++) {
      let t = rand() * total;
      let s = 0;
      while (t > segs[s][2] && s < segs.length - 1) { t -= segs[s][2]; s++; }
      const [a, b, l] = segs[s];
      const ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l;
      const off = (rand() - 0.5) * spread * 2;
      const x = a[0] + ux * t - uy * off, y = a[1] + uy * t + ux * off;
      const hot = rand() < stress;
      g += `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${hot ? C.red : ink}" fill-opacity="${hot ? 0.95 : 0.9}"/>`;
    }
    return g;
  }

  // Sheet border with zone ticks and letters, like a real drawing sheet.
  function sheetFrame(W, H, { ink = C.line, m = 16, gap = 20, cols = 12, rows = 8 } = {}) {
    let g = `<g stroke="${ink}" fill="none">`;
    g += `<rect x="${m}" y="${m}" width="${W - 2 * m}" height="${H - 2 * m}" stroke-width=".8" stroke-opacity=".6"/>`;
    g += `<rect x="${m + gap}" y="${m + gap}" width="${W - 2 * (m + gap)}" height="${H - 2 * (m + gap)}" stroke-width="1.8"/>`;
    const iw = W - 2 * (m + gap), ih = H - 2 * (m + gap);
    for (let i = 1; i < cols; i++) {
      const x = m + gap + (iw / cols) * i;
      g += `<line x1="${x}" y1="${m}" x2="${x}" y2="${m + gap}" stroke-width=".8"/><line x1="${x}" y1="${H - m - gap}" x2="${x}" y2="${H - m}" stroke-width=".8"/>`;
    }
    for (let i = 1; i < rows; i++) {
      const y = m + gap + (ih / rows) * i;
      g += `<line x1="${m}" y1="${y}" x2="${m + gap}" y2="${y}" stroke-width=".8"/><line x1="${W - m - gap}" y1="${y}" x2="${W - m}" y2="${y}" stroke-width=".8"/>`;
    }
    // fine tick ruler on the inner border
    for (let x = m + gap; x <= W - m - gap; x += 10) g += `<line x1="${x}" y1="${m + gap}" x2="${x}" y2="${m + gap + ((x - m - gap) % 50 === 0 ? 6 : 3)}" stroke-width=".5" stroke-opacity=".6"/>`;
    g += `</g>`;
    const letters = 'ABCDEFGHIJ';
    for (let i = 0; i < cols; i++) {
      const x = m + gap + (iw / cols) * (i + 0.5);
      g += `<text x="${x}" y="${m + gap / 2 + 4}" text-anchor="middle" class="mono" font-size="9" fill="${ink}" fill-opacity=".8">${i + 1}</text>`;
      g += `<text x="${x}" y="${H - m - gap / 2 + 4}" text-anchor="middle" class="mono" font-size="9" fill="${ink}" fill-opacity=".8">${i + 1}</text>`;
    }
    for (let i = 0; i < rows; i++) {
      const y = m + gap + (ih / rows) * (i + 0.5);
      g += `<text x="${m + gap / 2}" y="${y + 3}" text-anchor="middle" class="mono" font-size="9" fill="${ink}" fill-opacity=".8">${letters[i]}</text>`;
      g += `<text x="${W - m - gap / 2}" y="${y + 3}" text-anchor="middle" class="mono" font-size="9" fill="${ink}" fill-opacity=".8">${letters[i]}</text>`;
    }
    return g;
  }

  function northArrow(x, y, { ink = C.line, r = 22 } = {}) {
    return `<g stroke="${ink}" fill="none">
      <circle cx="${x}" cy="${y}" r="${r}" stroke-width="1"/>
      <circle cx="${x}" cy="${y}" r="${r - 4}" stroke-width=".5" stroke-opacity=".6"/>
      <path d="M${x},${y - r + 2} L${x + 7},${y + 8} L${x},${y + 3} Z" fill="${ink}"/>
      <path d="M${x},${y - r + 2} L${x - 7},${y + 8} L${x},${y + 3} Z" stroke-width="1"/>
    </g><text x="${x}" y="${y - r - 6}" text-anchor="middle" class="lbl" font-size="14" fill="${ink}">N</text>`;
  }

  function scaleBar(x, y, { ink = C.line, seg = 32, n = 4, caption = '' } = {}) {
    let g = `<g stroke="${ink}" stroke-width="1">`;
    for (let i = 0; i < n; i++) g += `<rect x="${x + i * seg}" y="${y}" width="${seg}" height="6" fill="${i % 2 ? 'none' : ink}"/>`;
    g += `</g>`;
    for (let i = 0; i <= n; i++) g += `<text x="${x + i * seg}" y="${y + 18}" text-anchor="middle" class="mono" font-size="9" fill="${ink}">${i * 100}</text>`;
    if (caption) g += `<text x="${x}" y="${y - 7}" class="mono" font-size="9" fill="${ink}" fill-opacity=".8">${caption}</text>`;
    return g;
  }

  // A drafting-scale gauge: relative 0-100, never an absolute measurement.
  function gauge(x, y, w, label, value, { ink = C.line, prev = null, accent = C.red, ghost = C.graphite } = {}) {
    let g = `<text x="${x}" y="${y}" class="mono" font-size="9.5" fill="${ink}" letter-spacing=".06em">${label}</text>`;
    const by = y + 10;
    g += `<g stroke="${ink}"><line x1="${x}" y1="${by + 10}" x2="${x + w}" y2="${by + 10}" stroke-width="1"/>`;
    for (let i = 0; i <= 20; i++) {
      const tx = x + (w / 20) * i;
      g += `<line x1="${tx}" y1="${by + 10}" x2="${tx}" y2="${by + 10 - (i % 10 === 0 ? 9 : i % 2 === 0 ? 5 : 3)}" stroke-width=".7"/>`;
    }
    g += `</g>`;
    const vx = x + (w * value) / 100;
    if (prev !== null) {
      const px = x + (w * prev) / 100;
      g += `<path d="M${px},${by + 12} l-4,7 h8 z" fill="none" stroke="${ink}" stroke-opacity=".45" stroke-dasharray="2 1.5"/>`;
      g += `<line x1="${px}" y1="${by + 28}" x2="${vx}" y2="${by + 28}" stroke="${accent}" stroke-width="1.4" marker-end="url(#arrow-${accent === C.red ? 'red' : 'ink'})"/>`;
      const dlt = value - prev;
      g += `<text x="${x + w}" y="${y}" text-anchor="end" class="mono" font-size="9.5" fill="${accent}">${dlt > 0 ? '+' : ''}${dlt}</text>`;
    }
    g += `<path d="M${vx},${by + 12} l-4.5,8 h9 z" fill="${ink}"/>`;
    g += `<text x="${vx}" y="${by - 2}" text-anchor="middle" class="mono" font-size="9" fill="${ink}">${value}</text>`;
    return g;
  }

  function defs(ink = C.line) {
    return `<defs>
      <marker id="arrow-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9" fill="none" stroke="${C.red}" stroke-width="1.6"/></marker>
      <marker id="arrow-ink" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9" fill="none" stroke="${ink}" stroke-width="1.6"/></marker>
      <marker id="dot-red" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5"><circle cx="5" cy="5" r="4" fill="${C.red}"/></marker>
      <filter id="paper" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" seed="4" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .07 0"/>
      </filter>
      <filter id="paper-coarse" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="2" seed="9" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .09 -.02"/>
      </filter>
      <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="${ink}" stroke-width=".7" stroke-opacity=".5"/></pattern>
    </defs>`;
  }

  // Fit a fixed-size board frame into the viewport width.
  function fit(selector, W) {
    const run = () => document.querySelectorAll(selector).forEach((el) => {
      const s = Math.min(1, (window.innerWidth - 32) / W);
      el.style.transform = `scale(${s})`;
      el.parentElement.style.height = `${el.offsetHeight * s}px`;
    });
    window.addEventListener('resize', run);
    run();
  }

  window.D = { C, rng, cloudPath, delta, building, reservoir, road, rail, district, particles, sheetFrame, northArrow, scaleBar, gauge, defs, fit };
})();
