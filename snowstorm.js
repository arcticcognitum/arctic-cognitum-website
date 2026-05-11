// snowstorm.js — premium drifting-snow field
// window.Snowstorm.mount(canvas, { intensity }) -> { setIntensity, destroy }
//
// Improvements vs. v1:
//  - soft pre-rendered flake sprite (radial gradient, no hard circles)
//  - three parallax depth layers (far / mid / near) with different sizes,
//    speeds, blur and opacity
//  - smoother, slower fall by default ("premium feel")
//  - layered sum-of-sines wind for organic gusts
//  - near layer renders with motion blur during gusts
//  - tiny rotational sparkle on the nearest flakes
//  - additive blending so flakes layer cleanly without banding

(function () {
  // count is total across all layers; speeds are global multipliers
  const PRESETS = {
    off:      { count: 0,    wind: 0,    gust: 0,    fog: 0,    speed: 0    },
    // "subtle" is the new default — slow, sparse, premium
    subtle:   { count: 130,  wind: 0.012, gust: 0.010, fog: 0.04, speed: 0.038 },
    storm:    { count: 340,  wind: 0.055, gust: 0.035, fog: 0.12, speed: 0.085 },
    blizzard: { count: 720,  wind: 0.180, gust: 0.110, fog: 0.26, speed: 0.22  },
  };

  // layer mix — fractions of total `count`
  const LAYERS = [
    // far: tiny, blurred, slow — atmospheric haze
    { share: 0.45, sizeMin: 0.5, sizeMax: 1.2, depth: 0.12, blur: 1.4, alphaMin: 0.18, alphaMax: 0.40, speed: 0.35 },
    // mid: the body of the snow
    { share: 0.40, sizeMin: 1.1, sizeMax: 2.4, depth: 0.50, blur: 0.6, alphaMin: 0.45, alphaMax: 0.75, speed: 0.75 },
    // near: large, soft, slightly motion-blurred during gusts
    { share: 0.15, sizeMin: 2.4, sizeMax: 4.6, depth: 1.00, blur: 0.0, alphaMin: 0.70, alphaMax: 0.95, speed: 1.20 },
  ];

  function mount(canvas, opts = {}) {
    const ctx = canvas.getContext('2d', { alpha: true });
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    let preset = PRESETS[opts.intensity] || PRESETS.subtle;
    let flakes = [];
    let sprites = {}; // cached flake bitmaps by layer index
    let t = 0;
    let raf = 0;
    let running = true;
    let lastTs = 0;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      W = Math.max(1, rect.width);
      H = Math.max(1, rect.height);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rebuildSprites();
      buildField();
    }

    function rand(a, b) { return a + Math.random() * (b - a); }

    // ---- pre-render a soft flake sprite per layer (radial gradient, optional blur) ----
    function rebuildSprites() {
      sprites = {};
      LAYERS.forEach((layer, i) => {
        const r = Math.ceil(layer.sizeMax * 4 + layer.blur * 4);
        const s = r * 2;
        const off = document.createElement('canvas');
        off.width = off.height = s;
        const c = off.getContext('2d');
        if (layer.blur > 0) c.filter = `blur(${layer.blur}px)`;
        const grad = c.createRadialGradient(r, r, 0, r, r, r);
        // soft white core fading to fully transparent — no hard edge
        grad.addColorStop(0.0,  'rgba(255,255,255,1)');
        grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
        grad.addColorStop(0.7,  'rgba(255,255,255,0.10)');
        grad.addColorStop(1.0,  'rgba(255,255,255,0)');
        c.fillStyle = grad;
        c.beginPath();
        c.arc(r, r, r, 0, Math.PI * 2);
        c.fill();
        sprites[i] = { canvas: off, r };
      });
    }

    function buildField() {
      flakes = [];
      const total = Math.round(preset.count);
      LAYERS.forEach((layer, li) => {
        const n = Math.round(total * layer.share);
        for (let i = 0; i < n; i++) {
          flakes.push(makeFlake(li, true));
        }
      });
    }

    function makeFlake(layerIdx, initial) {
      const L = LAYERS[layerIdx];
      const size = rand(L.sizeMin, L.sizeMax);
      const alpha = rand(L.alphaMin, L.alphaMax);
      return {
        l: layerIdx,
        x: Math.random() * W,
        y: initial ? Math.random() * H : -10,
        size,
        alpha,
        // baseline fall speed (px / frame at 60fps reference) — scaled later by preset.speed and dt
        vy: rand(0.18, 0.34) * L.speed,
        // each flake has a slightly different wind sensitivity (parallax + individuality)
        windAffinity: L.depth * rand(0.85, 1.15),
        // soft horizontal wobble — sinusoidal sway
        wobbleAmp: rand(0.15, 0.50) * (1 - L.depth * 0.4),
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleSpeed: rand(0.003, 0.012),
        // gentle twinkle for near layer
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: rand(0.006, 0.018),
      };
    }

    function step(ts) {
      if (!running) return;
      // smooth dt scaling so it feels right on any refresh rate
      if (!lastTs) lastTs = ts || 0;
      const dt = Math.min(2.5, ((ts || 0) - lastTs) / 16.667); // 1.0 = 60fps frame
      lastTs = ts || 0;
      t += dt;

      ctx.clearRect(0, 0, W, H);

      // wind: smooth sum of sines (organic, premium feel)
      const wind =
        preset.wind +
        Math.sin(t * 0.0032) * preset.gust * 0.9 +
        Math.sin(t * 0.0091 + 1.2) * preset.gust * 0.5 +
        Math.sin(t * 0.0167 + 0.4) * preset.gust * 0.25;

      // fog wash — drawn first so flakes sit on top
      if (preset.fog > 0) {
        const fogA = preset.fog * (0.55 + 0.45 * Math.sin(t * 0.0026));
        const grad = ctx.createLinearGradient(0, H * 0.2, W * 0.7, H * 0.9);
        grad.addColorStop(0,   `rgba(220,232,242,0)`);
        grad.addColorStop(0.5, `rgba(205,220,236,${fogA * 0.32})`);
        grad.addColorStop(1,   `rgba(190,205,225,0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }

      // additive blending makes layered flakes feel luminous, not muddy
      ctx.globalCompositeOperation = 'lighter';

      const speedScale = preset.speed;
      // motion-blur multiplier proportional to wind magnitude — stretches near flakes
      const windAbs = Math.abs(wind);
      const blurStretch = Math.min(2.2, 1 + windAbs * 4); // 1..2.2

      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i];
        const L = LAYERS[f.l];
        f.wobblePhase += f.wobbleSpeed * dt;
        const wobble = Math.sin(f.wobblePhase) * f.wobbleAmp;

        // movement — dt-scaled so frame rate doesn't change the look
        f.x += (wind * f.windAffinity * 60 + wobble) * dt;
        f.y += f.vy * speedScale * 60 * dt;

        // recycle when off-screen
        if (f.y > H + 12) {
          f.y = -10;
          f.x = Math.random() * W * 1.2 - W * 0.1;
          f.wobblePhase = Math.random() * Math.PI * 2;
        } else if (f.x > W + 30) {
          f.x = -30 + Math.random() * 20;
          f.y = Math.random() * H * 0.8;
        } else if (f.x < -30) {
          f.x = W + 10;
          f.y = Math.random() * H * 0.8;
        }

        const sprite = sprites[f.l];
        if (!sprite) continue;

        // size in screen px; we draw the pre-rendered soft disc
        // sprite has radius sprite.r in its own canvas. scale = desired/source.
        let drawW = f.size * 4;
        let drawH = f.size * 4;

        // motion blur stretching: only on the near layer, and only when wind is strong
        let stretchX = 1;
        if (f.l === 2 && blurStretch > 1.15) {
          stretchX = blurStretch;
        }

        // twinkle alpha modulation (near layer only)
        let a = f.alpha;
        if (f.l === 2) {
          f.twinklePhase += f.twinkleSpeed * dt;
          a *= 0.78 + 0.22 * Math.sin(f.twinklePhase);
        }

        ctx.globalAlpha = a;
        const drawScaledW = drawW * stretchX;
        ctx.drawImage(
          sprite.canvas,
          f.x - drawScaledW / 2,
          f.y - drawH / 2,
          drawScaledW,
          drawH
        );
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(step);
    }

    function setIntensity(name) {
      preset = PRESETS[name] || PRESETS.off;
      buildField();
    }

    function destroy() {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visChange);
    }

    function visChange() {
      // pause when tab is hidden — saves cycles and avoids the "burst" when
      // the user returns and the timestamp jumps
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        lastTs = 0;
        raf = requestAnimationFrame(step);
      }
    }

    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', visChange);
    resize();
    raf = requestAnimationFrame(step);

    return { setIntensity, destroy };
  }

  window.Snowstorm = { mount, PRESETS };
})();
