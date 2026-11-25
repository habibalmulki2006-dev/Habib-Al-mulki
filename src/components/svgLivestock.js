export function getLivestockSVG(jenis, colorHex = '#9A3412', mode = 'samping') {
  const isGoat = jenis.includes('Kambing') || jenis.includes('Domba');
  const isKerbau = jenis.includes('Kerbau');
  const bodyColor = isKerbau ? '#334155' : jenis.includes('Domba') ? '#CBD5E1' : colorHex;
  const strokeColor = '#1E293B';

  if (mode === 'gigi') {
    return `
      <div style="text-align:center; width:100%;">
        <div style="font-size:0.75rem; font-weight:700; color:#065f46; margin-bottom:6px;">Inspeksi Gigi Seri (Poel Permanen)</div>
        <svg style="width:190px; height:128px; margin:0 auto;" viewBox="0 0 220 140" fill="none" aria-label="Ilustrasi kondisi gigi poel">
          <rect x="20" y="25" width="180" height="90" rx="45" fill="#FECDD3" stroke="#E11D48" stroke-width="2"/>
          <path d="M40 70 Q110 95 180 70" stroke="#BE123C" stroke-width="3" fill="none"/>
          <rect x="62" y="58" width="14" height="22" rx="3" fill="#FEF3C7" stroke="#64748B" stroke-width="1.5"/>
          <rect x="144" y="58" width="14" height="22" rx="3" fill="#FEF3C7" stroke="#64748B" stroke-width="1.5"/>
          <rect x="82" y="46" width="24" height="36" rx="4" fill="#FFFFFF" stroke="#15803D" stroke-width="2.5"/>
          <rect x="114" y="46" width="24" height="36" rx="4" fill="#FFFFFF" stroke="#15803D" stroke-width="2.5"/>
        </svg>
        <p style="font-size:0.72rem; color:#475569; margin-top:4px;">Sepasang gigi seri permanen tumbuh sempurna (Cukup Umur / Sah Kurban)</p>
      </div>
    `;
  }

  if (mode === 'depan') {
    return `
      <div style="text-align:center; width:100%;">
        <div style="font-size:0.75rem; font-weight:700; color:#065f46; margin-bottom:4px;">Inspeksi Wajah, Tanduk &amp; Dada Depan</div>
        <svg style="width:176px; height:142px; margin:0 auto;" viewBox="0 0 200 160" fill="none" aria-label="Ilustrasi tampak depan ternak">
          <ellipse cx="100" cy="148" rx="58" ry="6" fill="#D1FAE5"/>
          <rect x="65" y="72" width="70" height="54" rx="20" fill="${bodyColor}" stroke="${strokeColor}" stroke-width="2"/>
          <rect x="74" y="114" width="12" height="30" rx="5" fill="${bodyColor}" stroke="${strokeColor}" stroke-width="2"/>
          <rect x="114" y="114" width="12" height="30" rx="5" fill="${bodyColor}" stroke="${strokeColor}" stroke-width="2"/>
          <path d="M72 42 Q48 25 62 15" stroke="#475569" stroke-width="5" stroke-linecap="round"/>
          <path d="M128 42 Q152 25 138 15" stroke="#475569" stroke-width="5" stroke-linecap="round"/>
          <rect x="72" y="34" width="56" height="52" rx="22" fill="${bodyColor}" stroke="${strokeColor}" stroke-width="2"/>
          <circle cx="86" cy="54" r="3.5" fill="#0F172A"/>
          <circle cx="114" cy="54" r="3.5" fill="#0F172A"/>
          <ellipse cx="100" cy="72" rx="16" ry="10" fill="#FDA4AF" stroke="${strokeColor}" stroke-width="1.5"/>
          <circle cx="94" cy="72" r="2" fill="#1E293B"/>
          <circle cx="106" cy="72" r="2" fill="#1E293B"/>
        </svg>
        <p style="font-size:0.72rem; color:#475569;">Mata jernih, moncong basah sehat, kedua tanduk &amp; kaki simetris</p>
      </div>
    `;
  }

  if (mode === 'belakang') {
    return `
      <div style="text-align:center; width:100%;">
        <div style="font-size:0.75rem; font-weight:700; color:#065f46; margin-bottom:4px;">Inspeksi Postur Kaki Belakang, Pinggul &amp; Kuku</div>
        <svg style="width:176px; height:142px; margin:0 auto;" viewBox="0 0 200 160" fill="none" aria-label="Ilustrasi tampak belakang ternak">
          <ellipse cx="100" cy="148" rx="58" ry="6" fill="#D1FAE5"/>
          <rect x="62" y="42" width="76" height="68" rx="28" fill="${bodyColor}" stroke="${strokeColor}" stroke-width="2"/>
          <rect x="70" y="96" width="14" height="46" rx="6" fill="${bodyColor}" stroke="${strokeColor}" stroke-width="2"/>
          <rect x="116" y="96" width="14" height="46" rx="6" fill="${bodyColor}" stroke="${strokeColor}" stroke-width="2"/>
          <rect x="69" y="136" width="16" height="8" rx="3" fill="#1E293B"/>
          <rect x="115" y="136" width="16" height="8" rx="3" fill="#1E293B"/>
          <path d="M100 52 L100 118" stroke="#1E293B" stroke-width="5" stroke-linecap="round"/>
          <ellipse cx="100" cy="122" rx="5" ry="9" fill="#1E293B"/>
          <rect x="52" y="46" width="12" height="9" rx="2" fill="#22C55E" stroke="#065F46" stroke-width="1.5"/>
        </svg>
        <p style="font-size:0.72rem; color:#475569;">Kaki belakang kokoh, kuku utuh bebas luka, area belakang bersih sehat</p>
      </div>
    `;
  }

  if (isGoat) {
    return `
      <svg style="width:176px; height:128px; margin:0 auto;" viewBox="0 0 220 150" fill="none" aria-label="Ilustrasi tampak samping kambing atau domba">
        <ellipse cx="110" cy="136" rx="68" ry="7" fill="#D1FAE5"/>
        <rect x="68" y="96" width="10" height="36" rx="4" fill="${bodyColor}" stroke="${strokeColor}" stroke-width="2"/>
        <rect x="85" y="98" width="10" height="34" rx="4" fill="${bodyColor}" stroke="${strokeColor}" stroke-width="2"/>
        <rect x="132" y="96" width="10" height="36" rx="4" fill="${bodyColor}" stroke="${strokeColor}" stroke-width="2"/>
        <rect x="148" y="98" width="10" height="34" rx="4" fill="${bodyColor}" stroke="${strokeColor}" stroke-width="2"/>
        <rect x="58" y="56" width="104" height="50" rx="24" fill="${bodyColor}" stroke="${strokeColor}" stroke-width="2"/>
        <path d="M160 66 L174 54" stroke="${strokeColor}" stroke-width="4" stroke-linecap="round"/>
        <rect x="34" y="36" width="42" height="32" rx="14" fill="${bodyColor}" stroke="${strokeColor}" stroke-width="2"/>
        <path d="M58 36 Q66 18 76 22" stroke="#475569" stroke-width="4" stroke-linecap="round"/>
        <path d="M44 68 L40 80 L48 72" fill="#64748B" stroke="${strokeColor}" stroke-width="1.5"/>
        <circle cx="48" cy="48" r="3" fill="#0F172A"/>
        <rect x="64" y="44" width="10" height="7" rx="2" fill="#22C55E"/>
      </svg>
    `;
  }

  return `
    <svg style="width:190px; height:128px; margin:0 auto;" viewBox="0 0 240 150" fill="none" aria-label="Ilustrasi tampak samping sapi atau kerbau">
      <ellipse cx="122" cy="138" rx="82" ry="7" fill="#D1FAE5"/>
      <rect x="68" y="96" width="13" height="38" rx="5" fill="${bodyColor}" stroke="${strokeColor}" stroke-width="2"/>
      <rect x="90" y="98" width="13" height="36" rx="5" fill="${bodyColor}" stroke="${strokeColor}" stroke-width="2"/>
      <rect x="150" y="96" width="13" height="38" rx="5" fill="${bodyColor}" stroke="${strokeColor}" stroke-width="2"/>
      <rect x="172" y="98" width="13" height="36" rx="5" fill="${bodyColor}" stroke="${strokeColor}" stroke-width="2"/>
      <rect x="56" y="48" width="134" height="58" rx="26" fill="${bodyColor}" stroke="${strokeColor}" stroke-width="2"/>
      <ellipse cx="86" cy="48" rx="22" ry="12" fill="${bodyColor}" stroke="${strokeColor}" stroke-width="2"/>
      <path d="M188 64 Q198 86 192 108" stroke="${strokeColor}" stroke-width="4" stroke-linecap="round"/>
      <rect x="26" y="38" width="46" height="36" rx="15" fill="${bodyColor}" stroke="${strokeColor}" stroke-width="2"/>
      <path d="M52 38 Q42 20 56 16" stroke="#475569" stroke-width="4.5" stroke-linecap="round"/>
      <circle cx="42" cy="51" r="3.2" fill="#0F172A"/>
      <ellipse cx="29" cy="62" rx="6" ry="8" fill="#FDA4AF" stroke="${strokeColor}" stroke-width="1.5"/>
      <rect x="60" y="45" width="11" height="8" rx="2" fill="#22C55E"/>
    </svg>
  `;
}

export function generateAngleCanvasPreview(jenis, angleKey, angleTitle, angleSub) {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, 320);
  grad.addColorStop(0, '#ECFDF5');
  grad.addColorStop(1, '#FFFFFF');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 480, 320);

  ctx.strokeStyle = '#16A34A';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 460, 300);

  ctx.fillStyle = '#15803D';
  ctx.fillRect(24, 24, 250, 30);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`TERNAKACEH · ${angleTitle.toUpperCase()}`, 34, 44);

  const isGoat = jenis.includes('Kambing') || jenis.includes('Domba');
  const isKerbau = jenis.includes('Kerbau');
  const coatColor = isKerbau
    ? '#334155'
    : jenis.includes('Domba')
      ? '#CBD5E1'
      : isGoat
        ? '#D97706'
        : '#9A3412';

  ctx.save();
  if (angleKey === 'gigi') {
    ctx.fillStyle = '#FDA4AF';
    ctx.beginPath();
    ctx.roundRect(120, 155, 240, 58, 18);
    ctx.fill();

    ctx.fillStyle = '#FEF3C7';
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 2;
    ctx.fillRect(142, 132, 24, 34);
    ctx.strokeRect(142, 132, 24, 34);
    ctx.fillRect(314, 132, 24, 34);
    ctx.strokeRect(314, 132, 24, 34);

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#15803D';
    ctx.lineWidth = 3;
    ctx.fillRect(184, 102, 46, 66);
    ctx.strokeRect(184, 102, 46, 66);
    ctx.fillRect(250, 102, 46, 66);
    ctx.strokeRect(250, 102, 46, 66);
  } else if (angleKey === 'depan') {
    ctx.fillStyle = coatColor;
    ctx.beginPath();
    ctx.roundRect(175, 135, 130, 95, 28);
    ctx.fill();
    ctx.fillRect(190, 215, 22, 45);
    ctx.fillRect(268, 215, 22, 45);
    ctx.beginPath();
    ctx.roundRect(192, 82, 96, 82, 26);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(192, 95);
    ctx.quadraticCurveTo(155, 75, 175, 62);
    ctx.moveTo(288, 95);
    ctx.quadraticCurveTo(325, 75, 305, 62);
    ctx.stroke();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(216, 118, 5, 0, Math.PI * 2);
    ctx.arc(264, 118, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (angleKey === 'belakang') {
    ctx.fillStyle = coatColor;
    ctx.beginPath();
    ctx.roundRect(168, 88, 144, 115, 36);
    ctx.fill();
    ctx.fillRect(185, 185, 26, 68);
    ctx.fillRect(269, 185, 26, 68);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(183, 245, 30, 12);
    ctx.fillRect(267, 245, 30, 12);
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(240, 108);
    ctx.lineTo(240, 215);
    ctx.stroke();
  } else {
    ctx.fillStyle = coatColor;
    ctx.beginPath();
    ctx.roundRect(135, 108, 225, 96, 34);
    ctx.fill();
    ctx.fillRect(156, 192, 20, 62);
    ctx.fillRect(186, 194, 20, 60);
    ctx.fillRect(296, 192, 20, 62);
    ctx.fillRect(324, 194, 20, 60);
    ctx.beginPath();
    ctx.roundRect(82, 92, 74, 58, 20);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(106, 112, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = '#064E3B';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`${jenis} — ${angleTitle}`, 24, 282);
  ctx.fillStyle = '#475569';
  ctx.font = '12px sans-serif';
  ctx.fillText(angleSub, 24, 300);

  return canvas.toDataURL('image/png');
}

export function compressUploadedImage(file, maxDimension = 720) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('File gambar tidak valid.'));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(event.target?.result ?? '');
    };
    reader.readAsDataURL(file);
  });
}
