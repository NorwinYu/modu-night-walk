/* 01-facade — procedural building skin.
   One shader replaces the tiled facade bitmaps: every bay/storey is a cell with
   a recessed opening, a room behind the glass (interior mapping), blinds and
   curtains, per-room light colour, analytic anti-aliasing and a far-field
   average so distant towers neither shimmer nor go black.
   Geometry contract (see 10-city wall builder):
     uv     : (bay index, storey index) — storey 0 is the ground floor
     aBld   : (seed, lit factor, ground kind 0 plain/1 shop/2 lobby/3 blank wall, led palette 0..1)
     aCell  : (bay width m, storey height m, top storey index, floodlight wash)
     color  : per-building tint */
(function () {
  const G = window.__G, THREE = G.THREE, M = G.M;

  const VERT_DECL = `
    attribute vec4 aBld; attribute vec4 aCell;
    varying vec4 vBld; varying vec4 vCell; varying vec3 vFxW; varying vec3 vFxN; varying vec2 vFxUv;`;
  const VERT_MAIN = `
    vFxUv = uv; vBld = aBld; vCell = aCell;
    vFxW = (modelMatrix * vec4(transformed, 1.0)).xyz;
    vFxN = normalize(mat3(modelMatrix) * normal);`;

  const FRAG_DECL = `
    varying vec4 vBld; varying vec4 vCell; varying vec3 vFxW; varying vec3 vFxN; varying vec2 vFxUv;
    uniform sampler2D uSignTex;
    float fxH(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float fxH1(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
    float fxN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(fxH(i), fxH(i + vec2(1.0, 0.0)), f.x), mix(fxH(i + vec2(0.0, 1.0)), fxH(i + vec2(1.0, 1.0)), f.x), f.y); }
    float fxBox(vec2 f, vec2 a, vec2 b, vec2 w){
      vec2 s = smoothstep(a - w, a + w, f) * (1.0 - smoothstep(b - w, b + w, f)); return s.x * s.y; }
    vec3 fxLed(float k){ return k < 0.3 ? vec3(1.0, 0.66, 0.28) : k < 0.5 ? vec3(0.25, 0.80, 1.0) : k < 0.7 ? vec3(0.95, 0.97, 1.0) : vec3(1.0, 0.30, 0.75); }
    // the room behind one opening: ray-box against side walls, floor/ceiling and back wall
    vec3 fxRoom(vec3 ro, vec3 rd, float rw, float rh, float D, float hr, int mode){
      float tx = rd.x > 1e-4 ? (rw - ro.x) / rd.x : (rd.x < -1e-4 ? -ro.x / rd.x : 1e6);
      float ty = rd.y > 1e-4 ? (rh - ro.y) / rd.y : (rd.y < -1e-4 ? -ro.y / rd.y : 1e6);
      float tz = D / rd.z;
      float t = min(tx, min(ty, tz));
      vec3 hp = ro + rd * t;
      float up = clamp(hp.y / rh, 0.0, 1.0);
      vec3 c;
      // things standing in the room: desks, racks, sofas — a silhouette plane part-way in
      float tm = D * 0.42 / rd.z;
      vec3 pm = ro + rd * tm;
      float mk = 0.0;
      if (tm < t && mode != 5) {
        float mx = pm.x * (mode == 4 ? 0.55 : 0.8) + hr * 13.0;
        float mh = fxH(vec2(floor(mx), hr * 71.0));
        float have = step(mode == 4 ? 0.45 : 0.3, fxH(vec2(floor(mx), hr * 37.0)));
        float top = mode == 4 ? 1.1 + 0.6 * mh : (mode == 2 ? 0.7 + 0.9 * mh : 0.75 + 0.5 * step(0.6, mh));
        float fxm = fract(mx);
        mk = have * step(0.12, fxm) * step(fxm, 0.88) * step(pm.y, top);
      }
      if (tz <= tx && tz <= ty) {
        vec3 wc = mode == 2 ? mix(vec3(0.80, 0.72, 0.60), vec3(0.70, 0.74, 0.76), fxH1(hr * 3.1))
                            : mix(vec3(0.62, 0.61, 0.58), vec3(0.46, 0.52, 0.60), fxH1(hr * 3.1));
        c = wc * (0.45 + 0.55 * up);
        if (mode == 4) {
          vec3 brand = 0.25 + 0.5 * vec3(fxH1(hr * 9.0), fxH1(hr * 19.0 + 3.0), fxH1(hr * 29.0 + 7.0));
          if (fxH1(hr * 43.0) < 0.55) {
            vec2 sg = vec2(hp.x * 3.4, hp.y * 2.9);
            vec2 si = floor(sg);
            vec3 stock = mix(vec3(0.55), 0.25 + 0.75 * vec3(fxH(si + hr * 9.0), fxH(si + hr * 19.0 + 3.0), fxH(si + hr * 29.0 + 7.0)), 0.55);
            float shelf = step(0.2, fract(sg.y)) * step(0.06, fract(sg.x)) * step(hp.y, min(rh * 0.7, 2.6));
            c = mix(vec3(0.34, 0.30, 0.26) * (0.6 + 0.4 * up), stock * 0.8, shelf);
          } else {
            c = brand * (0.55 + 0.45 * up);
            vec2 lg = vec2(hp.x - rw * 0.5, hp.y - rh * 0.55);
            c = mix(c, vec3(1.6), step(abs(lg.x), rw * 0.16) * step(abs(lg.y), 0.28));
          }
        } else if (mode == 5) {
          c = mix(vec3(0.46, 0.33, 0.22), vec3(0.80, 0.74, 0.64), step(0.5, fract(hp.x * 0.4))) * (0.5 + 0.5 * up);
          c += vec3(1.6, 1.3, 0.9) * (1.0 - smoothstep(0.0, 0.12, abs(hp.y - 1.15)));
        } else {
          float fx = hp.x * 0.9 + hr * 40.0;
          float fh = (0.5 + 1.3 * fxH(vec2(floor(fx), hr * 91.0))) * step(0.35, fxH(vec2(floor(fx), hr * 53.0)));
          c = mix(c, wc * vec3(0.22, 0.20, 0.19), step(hp.y, fh));
        }
      } else if (ty < tx) {
        if (rd.y > 0.0) {
          vec2 gf = abs(fract(vec2(hp.x / 1.5, hp.z / 1.8)) - 0.5);
          float strip = step(gf.y, 0.06) * step(gf.x, 0.40);
          float spot = 1.0 - smoothstep(0.05, 0.10, length(gf));
          float pnl = mode == 2 ? exp(-9.0 * (pow(hp.x / rw - 0.5, 2.0) + pow(hp.z / D - 0.45, 2.0)))
                                : (fxH1(hr * 17.0 + 0.4) < 0.55 ? strip : spot);
          c = mix(vec3(0.34, 0.335, 0.32), vec3(2.2), pnl);
        } else {
          c = (mode == 2 ? vec3(0.30, 0.22, 0.15) : mode == 5 ? vec3(0.42, 0.40, 0.37) : mode == 4 ? vec3(0.40, 0.38, 0.35) : vec3(0.20, 0.20, 0.21)) * (0.7 + 0.5 * fxN(hp.xz * 1.7));
        }
      } else {
        c = vec3(0.46, 0.44, 0.41) * (0.4 + 0.6 * up);
      }
      c *= mix(1.05, 0.5, clamp(hp.z / D, 0.0, 1.0));
      return mix(c, mode == 4 ? vec3(0.20, 0.15, 0.11) : vec3(0.06, 0.055, 0.05), mk);
    }`;

  const FRAG_MAIN = `
    vec3 fxAlb = vec3(0.5); float fxRough = 0.8; float fxMetal = 0.0; vec3 fxEmi = vec3(0.0); vec2 fxTilt = vec2(0.0);
    {
      float seed = vBld.x, litK = vBld.y, kind = vBld.z, led = vBld.w;
      float cw = max(vCell.x, 0.2), ch = max(vCell.y, 0.5), topV = vCell.z, wash = vCell.w;
      vec2 cuv = vFxUv;
      vec2 fw = max(fwidth(cuv), vec2(1e-5));
      vec2 aw = fw * 0.7;
      float lodx = clamp(fw.x * 2.0 - 0.3, 0.0, 1.0), lody = clamp(fw.y * 2.0 - 0.3, 0.0, 1.0);
      float lodm = max(lodx, lody);
      vec2 cell = floor(cuv), f = cuv - cell;
      bool isGround = cuv.y < 1.0;
      bool blank = kind > 2.5;
      int mode = FX_STYLE;
      if (isGround && kind > 0.5 && kind < 1.5) mode = 4;
      if (isGround && kind > 1.5 && kind < 2.5) mode = 5;

      // ---- opening rectangle, room module and lit probability per mode
      vec2 a, b; float roomB = 1.0, reveal = 0.2, pLit = 0.3, pMean = 0.3, D = 6.0;
      if (mode == 0) {
        a = vec2(0.035 / cw, 1.05 / ch); b = vec2(1.0 - 0.035 / cw, 1.0 - 0.04 / ch); roomB = 3.0; reveal = 0.0; D = 9.0;
      } else if (mode == 1) {
        a = vec2(0.16 / cw, 0.95 / ch); b = vec2(1.0 - 0.16 / cw, 1.0 - 0.60 / ch); roomB = 2.0; reveal = 0.16; D = 8.0;
      } else if (mode == 2) {
        float door = step(fxH(vec2(cell.x, seed * 5.0)), 0.28);
        a = vec2(0.5 - 0.80 / cw, mix(0.95, 0.14, door) / ch); b = vec2(0.5 + 0.80 / cw, min(2.50, ch - 0.35) / ch); reveal = 0.22; D = 4.5;
      } else if (mode == 3) {
        a = vec2(0.5 - 0.62 / cw, 0.85 / ch); b = vec2(0.5 + 0.62 / cw, (ch - 0.80) / ch); reveal = 0.32; D = 5.5;
      } else if (mode == 4) {
        float sdoor = step(fxH(vec2(cell.x, seed * 9.0)), 0.34);
        a = vec2(0.14 / cw, mix(0.34, 0.05, sdoor) / ch); b = vec2(1.0 - 0.14 / cw, 0.70); roomB = 2.0; reveal = 0.10; D = 7.0;
      } else {
        a = vec2(0.06 / cw, 0.03); b = vec2(1.0 - 0.06 / cw, 0.90); roomB = 4.0; reveal = 0.10; D = 12.0;
      }
      a.x = min(a.x, 0.30); b.x = max(b.x, 0.70);
      if (mode <= 1) {
        float on = step(fxH(vec2(cell.y * 1.37, seed * 131.0)), 0.30 * litK);
        pLit = mix(0.14 * litK, 0.88, on);
        pMean = 0.30 * litK * 0.88 + (1.0 - 0.30 * litK) * 0.14 * litK;
      } else if (mode == 2) { pLit = 0.38 * litK; pMean = pLit; }
      else if (mode == 3) { pLit = 0.46 * litK; pMean = pLit; }
      else if (mode == 4) { pLit = 0.80; pMean = pLit; }
      else { pLit = 0.97; pMean = pLit; }
      if (isGround && mode <= 1) { pLit = 0.78; pMean = 0.78; }
      pLit = mix(pLit, pMean, lody);
      float room = floor(cuv.x / roomB);
      float hr = fxH(vec2(room, cell.y) + seed * 57.31);
      float hc = fxH(cell + seed * 97.13);
      float litS = step(hr, pLit);
      float lit = mix(litS, pLit, lodx);

      // ---- view ray in wall space (x along the wall, y up, z into the building)
      vec3 Vw = normalize(vFxW - cameraPosition);
      vec3 Nw = normalize(vFxN);
      vec3 Tw = normalize(vec3(-Nw.z, 0.0, Nw.x) + vec3(1e-5, 0.0, 0.0));
      vec3 rd = vec3(dot(Vw, Tw), Vw.y, max(-dot(Vw, Nw), 0.06));
      vec2 par = rd.xy / rd.z;
      vec2 f2 = f + par * reveal / vec2(cw, ch);
      float open = blank ? 0.0 : fxBox(f, a, b, aw);
      float winK = open * fxBox(f2, a, b, aw);
      float revK = open - winK;
      vec2 wl = clamp((f2 - a) / max(b - a, vec2(1e-3)), 0.0, 1.0);

      // ---- wall material
      vec3 wallAlb; float wallR; float wallM;
      #if FX_STYLE == 0
        float fr = 1.0 - fxBox(f, vec2(a.x, -1.0), vec2(b.x, 2.0), aw);
        float tr = 1.0 - smoothstep(0.0, 0.05 / ch + aw.y, abs(f.y - a.y));
        fr = max(fr, tr * 0.8);
        wallAlb = mix(vec3(0.20, 0.24, 0.29), vec3(0.16, 0.17, 0.18), fr);
        wallR = mix(0.08, 0.38, fr); wallM = mix(0.9, 0.85, fr);
      #elif FX_STYLE == 1
        float jx = min(f.x, 1.0 - f.x) * cw, jy = min(f.y, 1.0 - f.y) * ch;
        float jn = 1.0 - min(smoothstep(0.0, 0.02 + aw.x * cw, jx), smoothstep(0.0, 0.02 + aw.y * ch, jy));
        wallAlb = vec3(0.27, 0.28, 0.30) * (1.0 - 0.55 * jn) * (0.92 + 0.16 * fxH(cell + seed * 3.0));
        wallR = 0.42; wallM = 0.45;
      #elif FX_STYLE == 2
        float gr = fxN(vec2(vFxW.x + vFxW.z, vFxW.y) * 0.21) * 0.6 + fxN(vec2(vFxW.x - vFxW.z, vFxW.y * 0.3) * 1.3) * 0.4;
        wallAlb = vec3(0.42, 0.40, 0.37) * (0.80 + 0.30 * gr);
        // small facing tiles, rain streaks, a darker splash zone
        float pw = max(fw.x * cw, fw.y * ch);
        float wxm = cuv.x * cw;
        float tl = 1.0 - smoothstep(0.004, 0.004 + pw, abs(fract(vFxW.y / 0.24) - 0.5) * 0.24);
        tl = max(tl, 1.0 - smoothstep(0.004, 0.004 + pw, abs(fract(wxm / 0.48 + 0.5 * floor(vFxW.y / 0.24)) - 0.5) * 0.48));
        wallAlb *= 1.0 - 0.30 * tl * (1.0 - smoothstep(0.03, 0.12, pw));
        wallAlb *= 0.80 + 0.20 * fxN(vec2(wxm * 2.6, vFxW.y * 0.10));
        wallAlb *= 0.72 + 0.28 * smoothstep(0.0, 0.9, vFxW.y);
        float under = step(a.x, f.x) * step(f.x, b.x) * step(f.y, a.y);
        wallAlb *= 1.0 - 0.22 * under * smoothstep(0.0, a.y, f.y);
        float slab = 1.0 - smoothstep(0.0, 0.10 / ch + aw.y, f.y);
        wallAlb = mix(wallAlb, vec3(0.50, 0.48, 0.45), slab * 0.7);
        wallR = 0.88; wallM = 0.0;
      #else
        float gr = fxN(vec2(vFxW.x + vFxW.z, vFxW.y) * 0.35);
        wallAlb = vec3(0.66, 0.58, 0.46) * (0.82 + 0.28 * gr);
        float rus = cuv.y < 2.0 ? 1.0 - smoothstep(0.0, 0.03 + aw.y * ch, abs(fract(f.y * ch / 0.55) - 0.5) * 0.55) : 0.0;
        wallAlb *= 1.0 - 0.45 * rus;
        float cor = smoothstep(1.0 - 0.34 / ch - aw.y, 1.0 - 0.34 / ch + aw.y, f.y);
        wallAlb = mix(wallAlb, wallAlb * 1.22, cor);
        wallAlb *= 1.0 - 0.5 * (1.0 - smoothstep(0.0, 0.10 / ch + aw.y, abs(f.y - (1.0 - 0.40 / ch))));
        float pil = 1.0 - smoothstep(0.26, 0.30 + aw.x * cw, min(f.x, 1.0 - f.x) * cw);
        wallAlb *= 1.0 + 0.12 * pil;
        wallR = 0.80; wallM = 0.0;
      #endif
      if (mode == 4) { wallAlb = mix(wallAlb * 0.42, vec3(0.07, 0.07, 0.08), 0.5); wallR = 0.5; wallM = 0.3; }

      // ---- glazing
      vec3 glassAlb = vec3(0.24, 0.28, 0.33); float glassR = 0.05, glassM = 0.92;
      float closed = 0.0;
      if (mode == 4 && litS < 0.5) {
        closed = 1.0;
        glassAlb = vec3(0.34, 0.35, 0.36) * (0.72 + 0.28 * smoothstep(0.2, 0.8, abs(fract(f.y * ch * 9.0) - 0.5) * 2.0));
        glassR = 0.55; glassM = 0.6;
      }
      float mull = 0.0;
      if (mode == 2 || mode == 3) {
        mull = 1.0 - smoothstep(0.03 / (cw * (b.x - a.x)), 0.03 / (cw * (b.x - a.x)) + aw.x / (b.x - a.x), abs(wl.x - 0.5));
      }
      if (mode == 4 && a.y * ch < 0.1) {
        mull = 1.0 - smoothstep(0.025 / (cw * (b.x - a.x)), 0.025 / (cw * (b.x - a.x)) + aw.x / (b.x - a.x), abs(wl.x - 0.5));
        mull = max(mull, 1.0 - smoothstep(0.03 / (ch * (b.y - a.y)), 0.03 / (ch * (b.y - a.y)) + aw.y / (b.y - a.y), abs(wl.y - 0.80)));
        glassAlb = mix(glassAlb, vec3(0.10), mull); glassR = mix(glassR, 0.4, mull);
      }
      if (mode == 2 || mode == 3) {
        if (mode == 3) mull = max(mull, 1.0 - smoothstep(0.03 / (ch * (b.y - a.y)), 0.03 / (ch * (b.y - a.y)) + aw.y / (b.y - a.y), abs(wl.y - 0.68)));
        glassAlb = mix(glassAlb, vec3(0.16, 0.15, 0.14), mull); glassR = mix(glassR, 0.5, mull); glassM = mix(glassM, 0.3, mull);
      }
      fxAlb = mix(wallAlb, glassAlb, winK);
      fxAlb = mix(fxAlb, wallAlb * 0.42, revK);
      fxRough = mix(wallR, glassR, winK); fxMetal = mix(wallM, glassM, winK);
      fxRough = mix(fxRough, max(fxRough, 0.22), lodm);

      // ---- interior
      float rw = cw * roomB;
      vec3 ro = vec3(fract(cuv.x / roomB) * rw + par.x * reveal, clamp(f2.y, 0.0, 1.0) * ch, 0.0);
      D *= 0.7 + 0.6 * fxH1(hr * 7.3 + 0.1);
      vec3 ic = fxRoom(ro, rd, rw, ch, D, hr, mode);
      float hb = fxH1(hc * 13.3 + 0.7);
      if (mode <= 1) {
        float drop = hb < 0.4 ? hb * 1.5 : 0.0;
        float blind = step(1.0 - drop, wl.y);
        ic = mix(ic, vec3(0.60, 0.58, 0.54) * (0.82 + 0.18 * step(0.5, fract(wl.y * (b.y - a.y) * ch * 14.0))), blind);
      } else if (mode == 2 || mode == 3) {
        float cur = hb < 0.7 ? 0.12 + hb * 0.62 : 0.0;
        float curtain = step(0.5 - cur * 0.5, abs(wl.x - 0.5));
        ic = mix(ic, vec3(0.72, 0.52, 0.36) * (0.78 + 0.22 * sin(wl.x * 70.0)), curtain * step(0.001, cur));
      }
      if (mode == 4) {
        float ph = fxH(cell + seed * 61.0);
        vec2 pc = (wl - vec2(0.30 + 0.4 * step(0.5, ph), 0.52)) / vec2(0.19, 0.24);
        float poster = step(ph, 0.42) * step(abs(pc.x), 1.0) * step(abs(pc.y), 1.0) * step(0.2, a.y * ch);
        vec3 pcol = 0.25 + 0.6 * vec3(fxH1(ph * 91.0), fxH1(ph * 57.0 + 0.3), fxH1(ph * 23.0 + 0.6));
        pcol = mix(pcol, vec3(0.95, 0.92, 0.85), step(abs(pc.y + 0.45), 0.22) * step(abs(pc.x), 0.8));
        ic = mix(ic, pcol * 0.8, poster);
      }
      ic = mix(ic, vec3(0.45), smoothstep(0.0, 0.7, lodm));
      float ht = fxH1(hr * 11.7 + 0.3);
      float li = 0.60 + 0.80 * fxH1(hr * 5.9 + 0.2);
      vec3 lc; vec3 lcMean;
      if (mode <= 1) { lc = ht < 0.5 ? vec3(1.0, 0.90, 0.74) : (ht < 0.85 ? vec3(0.86, 0.93, 1.0) : vec3(1.0, 0.80, 0.56)); lcMean = vec3(0.95, 0.90, 0.82); }
      else if (mode == 2) { lc = ht < 0.7 ? mix(vec3(1.0, 0.70, 0.40), vec3(1.0, 0.84, 0.62), ht / 0.7) : (ht < 0.9 ? vec3(0.95, 0.93, 0.88) : vec3(0.32, 0.40, 0.66)); lcMean = vec3(0.95, 0.78, 0.55); }
      else if (mode == 3) { lc = mix(vec3(1.0, 0.74, 0.44), vec3(1.0, 0.86, 0.64), ht); lcMean = vec3(1.0, 0.80, 0.54); }
      else if (mode == 4) { lc = mix(vec3(1.0, 0.90, 0.76), vec3(0.92, 0.96, 1.0), step(0.6, ht)); lcMean = vec3(0.97, 0.92, 0.84); li = 0.75 + 0.25 * li; }
      else { lc = vec3(1.0, 0.86, 0.66); lcMean = lc; li = 1.25; }
      float area = max(b.x - a.x, 0.0) * max(b.y - a.y, 0.0);
      vec3 emNear = ic * lc * li * winK * lit * (1.0 - mull) * (1.0 - closed);
      vec3 emFar = lcMean * 0.45 * area * pLit;
      fxEmi = mix(emNear, emFar, lodm) * 0.72;
      // a dark room is not a black hole: spill from the street and the corridor
      fxEmi += ic * vec3(0.55, 0.62, 0.75) * 0.030 * winK * (1.0 - lit) * (1.0 - closed) * (1.0 - lodm);
      // the lit city across the road, mirrored in dark panes
      {
        vec3 Rw = reflect(Vw, Nw);
        float fres = 0.05 + 0.95 * pow(1.0 - clamp(dot(-Vw, Nw), 0.0, 1.0), 4.0);
        vec3 glowR = vec3(0.11, 0.075, 0.05) * exp(-abs(Rw.y) * 5.0);
        fxEmi += glowR * fres * winK * (1.0 - 0.7 * lit) * (1.0 - closed);
      }
      // light spilling onto the reveal
      fxEmi += wallAlb * lc * revK * lit * 0.10;

      // ---- shop fascia: light boxes and cut-out lettering
      if (mode == 4) {
        vec2 sp = vec2(fract(cuv.x / roomB), f.y);
        float band = fxBox(sp, vec2(0.05, 0.76), vec2(0.95, 0.95), vec2(aw.x / roomB, aw.y));
        float hs = fxH(vec2(room, seed * 17.3));
        vec3 sc = hs < 0.25 ? vec3(1.0, 0.24, 0.18) : hs < 0.5 ? vec3(1.0, 0.78, 0.34) : hs < 0.75 ? vec3(0.28, 0.78, 1.0) : vec3(0.95, 0.95, 0.90);
        vec2 tq = vec2(1.0 - (sp.x - 0.18) / 0.64, (sp.y - 0.785) / 0.14);
        float inG = step(0.0, tq.x) * step(tq.x, 1.0) * step(0.0, tq.y) * step(tq.y, 1.0);
        float ci = floor(fxH(vec2(room * 2.3, seed * 41.0)) * 16.0);
        vec2 tuv = vec2((mod(ci, 4.0) + tq.x) / 4.0, 1.0 - (floor(ci / 4.0) + 1.0 - tq.y) / 4.0);
        float gl = inG * texture2D(uSignTex, tuv).r;
        float boxed = step(0.5, fxH(vec2(room * 1.7, seed * 29.0)));
        vec3 se = mix(sc * gl * 2.4 + sc * 0.05, sc * (1.0 - 0.85 * gl) * 1.15, boxed);
        fxEmi += band * se * (1.0 - closed * 0.8);
        fxAlb = mix(fxAlb, vec3(0.05), band);
      }

      // ---- architectural lighting
      if (led > 0.05 && !isGround) {
        vec3 lcol = fxLed(led);
        float per = 6.0;
        float dx = abs(fract(cuv.x / per + 0.5) - 0.5) * per * cw;
        float lw = max(0.05, fw.x * cw * 0.8);
        float line = (1.0 - smoothstep(lw * 0.6, lw * 1.4, dx)) * (0.05 / lw);
        fxEmi += lcol * line * 1.7;
        float fromTop = max(0.0, (topV - cuv.y) * ch);
        fxEmi += lcol * exp(-fromTop / 3.2) * 0.60 * (1.0 - winK * 0.5);
      }
      if (wash > 0.0) {
        float hy = max(vFxW.y, 0.0);
        float sc2 = 0.55 + 0.45 * cos((f.x - 0.5) * 6.2832);
        float g = wash * (0.22 + 0.78 * exp(-hy / 16.0)) * mix(1.0, sc2, exp(-hy / 7.0));
        fxEmi += wallAlb * vec3(1.0, 0.72, 0.40) * g * 0.60 * (1.0 - winK);
      }
      fxTilt = (vec2(fxH(cell + seed * 3.1), fxH(cell.yx + seed * 7.7)) - 0.5) * (mode == 0 ? 0.09 : 0.03) * winK * (1.0 - lodm);
    }
    diffuseColor.rgb *= fxAlb;`;

  // shop names for the fascia boards: 4x4 cells, white on black
  const SIGN_TEX = (function () {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, 1024, 256);
    const names = ['便利店 24H', '兰州拉面', '沙县小吃', '生煎·小笼', '奶茶 TEA', '咖啡 COFFEE', '大药房', '鲜果超市', '美发沙龙', '花店 FLORIST', '面包房', '临江嘴书店', '生活超市', '烟酒 · 茶叶', '眼镜 OPTICAL', '申江面馆'];
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    names.forEach((nm, i) => {
      x.font = (i % 3 === 0 ? '900 ' : '700 ') + '40px "PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
      x.fillText(nm, (i % 4) * 256 + 128, Math.floor(i / 4) * 64 + 33, 244);
    });
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  })();
  const STYLES = { glass: 0, panel: 1, stone: 2, lantan: 3 };
  function facadeFX(style, opts = {}) {
    const m = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.6, metalness: 0.1, vertexColors: true,
      envMapIntensity: opts.env ?? 1.0, emissive: 0x000000,
    });
    m.defines = Object.assign({}, m.defines, { FX_STYLE: STYLES[style] });
    m.name = 'facade-fx-' + style;
    m.userData.surfaceProcedural = true;
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uSignTex = { value: SIGN_TEX };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n' + VERT_DECL)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_MAIN);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + FRAG_DECL)
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_MAIN)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = fxRough;')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = fxMetal;')
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          { vec3 fxNw = normalize(vFxN); vec3 fxTv = normalize((viewMatrix * vec4(-fxNw.z, 0.0, fxNw.x, 0.0)).xyz);
            vec3 fxUv = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
            normal = normalize(normal + fxTv * fxTilt.x + fxUv * fxTilt.y); }`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += fxEmi;');
    };
    m.customProgramCacheKey = () => 'facade-fx-5';
    return m;
  }
  G.facadeFX = facadeFX;
  M.fx = {
    glass: facadeFX('glass', { env: 1.5 }),
    panel: facadeFX('panel', { env: 1.2 }),
    stone: facadeFX('stone', { env: 0.9 }),
    lantan: facadeFX('lantan', { env: 0.9 }),
  };

  /* Wall accumulator for the facade shader. */
  class FacadeGB {
    constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.bld = []; this.cell = []; }
    // a, c: [x,z] wall ends in CCW footprint order (outward normal on the right of a->c)
    wall(a, c, y0, y1, u0, u1, v0, v1, tint, bld, cell) {
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
      const nx = (c[1] - a[1]) / len, nz = -(c[0] - a[0]) / len;
      const P = [[a[0], y0, a[1], u0, v0], [a[0], y1, a[1], u0, v1], [c[0], y0, c[1], u1, v0], [c[0], y0, c[1], u1, v0], [a[0], y1, a[1], u0, v1], [c[0], y1, c[1], u1, v1]];
      for (const p of P) {
        this.pos.push(p[0], p[1], p[2]); this.nor.push(nx, 0, nz); this.uv.push(p[3], p[4]);
        this.col.push(tint.r, tint.g, tint.b);
        this.bld.push(bld[0], bld[1], bld[2], bld[3]); this.cell.push(cell[0], cell[1], cell[2], cell[3]);
      }
    }
    // free quad: corners bottom-left, bottom-right, top-right, top-left as seen from outside; uv per corner
    quad(a0, c0, c1, a1, uv, tint, bld, cell) {
      const ux = c0[0] - a0[0], uy = c0[1] - a0[1], uz = c0[2] - a0[2], vx = a1[0] - a0[0], vy = a1[1] - a0[1], vz = a1[2] - a0[2];
      let nx = vy * uz - vz * uy, ny = vz * ux - vx * uz, nz = vx * uy - vy * ux;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const P = [[a0, uv[0]], [a1, uv[3]], [c0, uv[1]], [c0, uv[1]], [a1, uv[3]], [c1, uv[2]]];
      for (const [p, t] of P) {
        this.pos.push(p[0], p[1], p[2]); this.nor.push(nx, ny, nz); this.uv.push(t[0], t[1]);
        this.col.push(tint.r, tint.g, tint.b);
        this.bld.push(bld[0], bld[1], bld[2], bld[3]); this.cell.push(cell[0], cell[1], cell[2], cell[3]);
      }
    }
    get count() { return this.pos.length / 3; }
    build() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
      g.setAttribute('aBld', new THREE.Float32BufferAttribute(this.bld, 4));
      g.setAttribute('aCell', new THREE.Float32BufferAttribute(this.cell, 4));
      g.computeBoundingSphere(); g.computeBoundingBox();
      return g;
    }
  }
  G.FacadeGB = FacadeGB;
  // give any geometry whose uv is already in (bay, storey) units the constant facade attributes
  G.fxAttrs = function (g, o = {}) {
    const n = g.attributes.position.count;
    const tint = o.tint || new THREE.Color(1, 1, 1);
    const col = new Float32Array(n * 3), bld = new Float32Array(n * 4), cell = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      col[i * 3] = tint.r; col[i * 3 + 1] = tint.g; col[i * 3 + 2] = tint.b;
      bld[i * 4] = o.seed ?? 0.37; bld[i * 4 + 1] = o.lit ?? 1; bld[i * 4 + 2] = o.kind ?? 0; bld[i * 4 + 3] = o.led ?? 0;
      cell[i * 4] = o.bay ?? 1.6; cell[i * 4 + 1] = o.fh ?? 4; cell[i * 4 + 2] = o.top ?? 1e4; cell[i * 4 + 3] = o.wash ?? 0;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aBld', new THREE.BufferAttribute(bld, 4));
    g.setAttribute('aCell', new THREE.BufferAttribute(cell, 4));
    return g;
  };
})();
