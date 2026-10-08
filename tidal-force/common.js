'use strict';
/* 기조력 단원 공용 도구
   좌표: 지구 반지름 = 1, 달은 +x 방향 거리 D(지구 반지름 단위)
   힘의 크기는 "지구 중심이 받는 달의 인력 = 1"로 정규화 */
const TF = {};

/* [data-tex] 요소를 KaTeX로 렌더링 */
window.addEventListener('load', () => {
  if (!window.katex) return;
  document.querySelectorAll('[data-tex]').forEach(el => katex.render(el.dataset.tex, el, { displayMode:true, throwOnError:false }));
});

TF.css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* 캔버스: 고해상도 + 크기 변화 대응. draw(ctx, w, h) 를 호출 */
TF.stage = (canvas, draw) => {
  const ctx = canvas.getContext('2d');
  const fit = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, w, h);
  };
  new ResizeObserver(fit).observe(canvas);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', fit);
  return { redraw: () => draw(ctx, canvas.clientWidth, canvas.clientHeight) };
};

/* 화면 배치: 지구는 왼쪽, 달은 오른쪽(축척 아님) */
TF.layout = (w, h) => {
  const R = Math.min(h*0.27, w*0.17);
  return { ex: w*0.34, ey: h*0.5, R, mx: w*0.88, my: h*0.5, mr: Math.max(10, R*0.27) };
};

/* 지구 표면의 점들 (+ 중심) */
TF.points = (n = 12) => {
  const pts = [{ x:0, y:0, center:true }];
  for (let i = 0; i < n; i++){ const a = 2*Math.PI*i/n; pts.push({ x:Math.cos(a), y:Math.sin(a), a }); }
  return pts;
};

/* 달의 인력 (정규화: 지구 중심에서 1) */
TF.gravity = (p, D) => {
  const dx = D - p.x, dy = -p.y, r = Math.hypot(dx, dy);
  const k = D*D / (r*r*r);
  return { x:dx*k, y:dy*k };
};
/* 공통질량중심 공전에 의한 원심력: 모든 지점에서 같음 */
TF.centrifugal = () => ({ x:-1, y:0 });
TF.tidal = (p, D) => { const g = TF.gravity(p, D), c = TF.centrifugal(); return { x:g.x + c.x, y:g.y + c.y }; };

/* 화살표 */
TF.arrow = (ctx, x1, y1, x2, y2, color, width = 2.5) => {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
  if (L < 0.5) return;
  const head = Math.min(10, L*0.45), ux = dx/L, uy = dy/L;
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - ux*head*0.6, y2 - uy*head*0.6); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ux*head - uy*head*0.5, y2 - uy*head + ux*head*0.5);
  ctx.lineTo(x2 - ux*head + uy*head*0.5, y2 - uy*head - ux*head*0.5);
  ctx.closePath(); ctx.fill();
  ctx.restore();
};

TF.earth = (ctx, x, y, R) => {
  ctx.save();
  ctx.fillStyle = TF.css('--sea'); ctx.globalAlpha = 0.35;
  ctx.beginPath(); ctx.arc(x, y, R, 0, 2*Math.PI); ctx.fill();
  ctx.globalAlpha = 1; ctx.fillStyle = TF.css('--earth');
  ctx.beginPath(); ctx.arc(x, y, R*0.96, 0, 2*Math.PI); ctx.fill();
  ctx.strokeStyle = TF.css('--muted'); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, R, 0, 2*Math.PI); ctx.stroke();
  ctx.restore();
};

TF.moon = (ctx, x, y, r, label) => {
  ctx.save();
  ctx.fillStyle = TF.css('--moon');
  ctx.beginPath(); ctx.arc(x, y, r, 0, 2*Math.PI); ctx.fill();
  if (label){
    ctx.fillStyle = TF.css('--muted'); ctx.font = '12px "SUIT Variable", "Noto Sans KR", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(label, x, y + r + 16);
  }
  ctx.restore();
};

TF.dot = (ctx, x, y, r, color) => { ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, 2*Math.PI); ctx.fill(); ctx.restore(); };

TF.text = (ctx, s, x, y, color, align = 'left', size = 12) => {
  ctx.save(); ctx.fillStyle = color; ctx.font = `${size}px "SUIT Variable", "Noto Sans KR", sans-serif`; ctx.textAlign = align; ctx.fillText(s, x, y); ctx.restore();
};

/* 사람(관측자) 모양: 발 (x, y), 머리 방향 단위벡터 (nx, ny) — 화면 좌표 */
TF.person = (ctx, x, y, nx, ny, size, color) => {
  const tx = -ny, ty = nx, P = (u, v) => [x + nx*u*size + tx*v*size, y + ny*u*size + ty*v*size];
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(2, size*0.13); ctx.lineCap = 'round';
  const line = (a, b) => { ctx.beginPath(); ctx.moveTo(...P(...a)); ctx.lineTo(...P(...b)); ctx.stroke(); };
  line([0, -0.2], [0.45, 0]); line([0, 0.2], [0.45, 0]);
  line([0.45, 0], [0.85, 0]);
  line([0.72, -0.28], [0.62, 0]); line([0.72, 0.28], [0.62, 0]);
  const [hx, hy] = P(1.0, 0); ctx.beginPath(); ctx.arc(hx, hy, size*0.16, 0, 2*Math.PI); ctx.fill();
  ctx.restore();
};
