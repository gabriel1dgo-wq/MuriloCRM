// Ilustrações vetoriais usadas como "fotos" da demonstração (sem arquivos externos).
const body =
  'M40,172 L40,142 Q42,122 72,116 L112,110 L152,72 Q160,66 172,66 L252,66 Q264,66 274,75 L312,108 L352,114 Q374,118 376,140 L378,172 Z';
const windows =
  '<path d="M162,76 L150,104 L206,104 L206,76 Z" fill="#1d2630"/><path d="M213,76 L213,104 L298,104 L268,79 Q262,76 255,76 Z" fill="#1d2630"/>';
const wheel = (x: number) =>
  `<circle cx="${x}" cy="174" r="30" fill="#0c0d0f"/><circle cx="${x}" cy="174" r="15" fill="#6b7178"/><circle cx="${x}" cy="174" r="5" fill="#2a2e33"/>`;

function scene(inner: string, label: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260">
<defs>
 <linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b3036"/><stop offset="1" stop-color="#15181b"/></linearGradient>
 <linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3d40"/><stop offset="1" stop-color="#1d1f21"/></linearGradient>
 <radialGradient id="l" cx=".5" cy="0" r=".9"><stop offset="0" stop-color="#fff5d6" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
 <radialGradient id="o" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#050506" stop-opacity=".85"/><stop offset=".7" stop-color="#1b1030" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
</defs>
<rect width="400" height="260" fill="url(#w)"/>
<g stroke="#ffffff" stroke-opacity=".04">${Array.from({ length: 12 }, (_, i) => `<line x1="${i * 36}" y1="0" x2="${i * 36}" y2="190"/>`).join('')}</g>
<rect y="190" width="400" height="70" fill="url(#f)"/>
<ellipse cx="250" cy="226" rx="70" ry="12" fill="url(#o)"/>
<ellipse cx="90" cy="240" rx="36" ry="7" fill="url(#o)"/>
<rect width="400" height="260" fill="url(#l)"/>
${inner}
<title>${label}</title>
</svg>`;
}

export function demoPhoto(color: string, variant: number, model: string) {
  const name = model.toUpperCase().replace(/[^A-Z0-9 .]/g, '');
  let inner: string;
  if (variant === 2) {
    inner = `<g transform="translate(70 40)">
<rect width="260" height="150" rx="14" fill="#101214" stroke="#40454b" stroke-width="3"/>
<rect x="30" y="26" width="140" height="70" rx="8" fill="#2b2f33"/>
${[0, 1, 2, 3].map((i) => `<rect x="${42 + i * 32}" y="36" width="22" height="50" rx="5" fill="#4a5058"/>`).join('')}
<circle cx="210" cy="60" r="26" fill="#23272b" stroke="#ffb000" stroke-width="3"/>
<path d="M30,120 C80,100 150,140 230,112" stroke="#111" stroke-width="10" fill="none"/>
<path d="M30,120 C80,100 150,140 230,112" stroke="#3b3f45" stroke-width="6" fill="none"/>
<rect x="190" y="104" width="50" height="30" rx="4" fill="#1b1d20" stroke="#5a6068"/>
</g>`;
    return uri(scene(inner, `${name} · MOTOR`));
  }
  const car = `<g><ellipse cx="208" cy="202" rx="170" ry="10" fill="#000" opacity=".5"/>
<path d="${body}" fill="${color}"/>
<path d="${body}" fill="url(#l)" opacity=".6"/>
<path d="M44,150 L376,150" stroke="#000" stroke-opacity=".25" stroke-width="2"/>
${windows}
<rect x="356" y="126" width="18" height="8" rx="3" fill="#ffe8a3"/>
<rect x="42" y="128" width="12" height="10" rx="2" fill="#b3261e"/>
${wheel(108)}${wheel(304)}</g>`;
  if (variant === 1) {
    inner = `<g transform="translate(-160 -90) scale(1.8)">${car}
<path d="M60,138 l18,-6 l-6,12 l14,-4" stroke="#1a1a1a" stroke-width="2.4" fill="none"/>
<path d="M52,152 q20,10 40,-2" stroke="#000" stroke-opacity=".5" stroke-width="3" fill="none"/></g>`;
    return uri(scene(inner, `${name} · AVARIA TRASEIRA`));
  }
  return uri(scene(car, `${name} · LATERAL`));
}
const uri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
