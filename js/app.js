import {
  ANNEES, BAREMES, GRILLE, ENTREES_DEFAUT,
  simuler, impotParTranche, reductionFamille, libelleAnnee,
} from './ir.js';

const CLE = 'simulateur-ir-maroc:v1';
const CHAMPS = ['brut', 'cimr', 'cmr', 'amo', 'mutuelles', 'autres', 'irBulletin', 'rni'];
const $ = (id) => document.getElementById(id);

const etat = { ...ENTREES_DEFAUT, periode: 'mois', anneeDetail: 2031 };

// ---------- Format ----------
const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dh = (n, d = false) => `${(d ? nf2 : nf).format(Math.round(n * (d ? 100 : 1)) / (d ? 100 : 1))} DH`;
const pct = (x) => `${(x * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
const k = (n) => (n === Infinity ? '∞' : n >= 1000 ? `${nf.format(n / 1000)} k` : nf.format(n));
const signe = (n) => (Math.abs(n) < 0.005 ? '—' : `${n > 0 ? '+' : '−'}${dh(Math.abs(n))}`);
const fois = () => (etat.periode === 'an' ? 12 : 1);

// ---------- Chargement / sauvegarde ----------
function charger() {
  const p = new URLSearchParams(location.search);
  let source = null;
  if ([...p.keys()].length) source = Object.fromEntries(p);
  else {
    try { source = JSON.parse(localStorage.getItem(CLE) || 'null'); } catch { source = null; }
  }
  if (!source) return;
  if (['prive', 'public', 'rni'].includes(source.mode)) etat.mode = source.mode;
  for (const c of [...CHAMPS, 'personnes']) if (source[c] !== undefined && source[c] !== '') etat[c] = Math.max(0, +source[c] || 0);
  if (source.periode === 'an') etat.periode = 'an';
}

function sauver() {
  try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch { /* stockage indisponible */ }
}

function lienPartage() {
  const p = new URLSearchParams({ mode: etat.mode, personnes: etat.personnes });
  const champs = etat.mode === 'prive' ? ['brut', 'cimr'] : etat.mode === 'public' ? ['brut', 'cmr', 'amo', 'mutuelles', 'autres', 'irBulletin'] : ['rni'];
  for (const c of champs) if (etat[c]) p.set(c, etat[c]);
  if (etat.periode === 'an') p.set('periode', 'an');
  return `${location.origin}${location.pathname}?${p}`;
}

// ---------- Rendu ----------
function rendre() {
  const s = simuler(etat);
  const m = fois();
  const unite = etat.periode === 'an' ? 'DH / an' : 'DH / mois';
  const [actuel, , , , , fin] = s.annees;

  // Interface du formulaire
  document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === etat.mode)));
  document.querySelectorAll('[data-show]').forEach((el) => { el.hidden = !el.dataset.show.split(' ').includes(etat.mode); });
  document.querySelectorAll('[data-periode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.periode === etat.periode)));
  $('personnes').textContent = etat.personnes;

  // Synthèse
  $('gainFinal').textContent = nf.format(Math.round(fin.gainVsActuel * m));
  $('gainUnit').textContent = unite;
  $('kicker').textContent = fin.gainVsActuel > 0.005 ? 'En 2031, la réforme vous fait gagner' : 'Gain en 2031 avec la réforme';
  $('irActuel').textContent = dh(actuel.ir * m);
  $('ir2031').textContent = dh(fin.ir * m);
  $('netLabel').textContent = s.base.avecNet ? 'Net aujourd\'hui → 2031' : 'Revenu après IR → 2031';
  $('net').textContent = `${nf.format(Math.round(actuel.net * m))} → ${nf.format(Math.round(fin.net * m))}`;
  $('cumul').textContent = dh(s.gainCumule);

  rendreGraphique(s, m);
  rendreTableau(s, m);
  rendreBase(s);
  rendreDetail(s);
  rendreBareme(s);
  sauver();
}

function rendreGraphique(s, m) {
  const W = Math.max(300, Math.min(760, $('chart').clientWidth || 640));
  const etroit = W < 560; // sur mobile : montants sans « DH », l'unité est rappelée dans la légende
  const H = etroit ? 240 : 280, top = 46, bottom = 32, left = etroit ? 4 : 12;
  const max = Math.max(1, ...s.annees.map((a) => a.ir * m), ...s.annees.map((a) => a.gainVsActuel * m));
  const n = s.annees.length;
  const slot = (W - 2 * left) / n;
  const bw = Math.min(34, slot * 0.32);
  const h = (v) => ((H - top - bottom) * v) / max;
  const y0 = H - bottom;
  const montant = (v) => (etroit ? nf.format(Math.round(v)) : dh(v));
  const taille = etroit ? 10 : 12;
  $('uniteGraphique').textContent = etroit ? (etat.periode === 'an' ? ' · en DH / an' : ' · en DH / mois') : '';
  let svg = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><line class="axis" x1="0" x2="${W}" y1="${y0}" y2="${y0}"/>`;
  s.annees.forEach((a, i) => {
    const cx = left + slot * i + slot / 2;
    const ir = a.ir * m, g = Math.max(0, a.gainVsActuel * m);
    const xi = cx - bw - 2, xg = cx + 2;
    // Étiquettes empilées et centrées au-dessus de la plus haute barre de l'année.
    const yIr = y0 - h(Math.max(ir, g)) - 6;
    const yG = yIr - taille - 4;
    svg += `<rect class="bar-ir" x="${xi}" y="${y0 - h(ir)}" width="${bw}" height="${Math.max(0, h(ir))}" rx="4"><title>IR ${libelleAnnee(a.annee)} : ${dh(ir)}</title></rect>`;
    svg += `<text class="val" x="${cx}" y="${yIr}" text-anchor="middle" style="font-size:${taille}px">${montant(ir)}</text>`;
    if (g > 0) {
      svg += `<rect class="bar-gain" x="${xg}" y="${y0 - h(g)}" width="${bw}" height="${h(g)}" rx="4"><title>Gain ${libelleAnnee(a.annee)} : ${dh(g)}</title></rect>`;
      svg += `<text class="val" x="${cx}" y="${yG}" text-anchor="middle" style="fill:var(--gain);font-size:${taille}px">+${montant(g)}</text>`;
    }
    svg += `<text x="${cx}" y="${H - 10}" text-anchor="middle">${libelleAnnee(a.annee)}</text>`;
  });
  $('chart').innerHTML = svg + '</svg>';
  $('chart').setAttribute('aria-label', s.annees.map((a) => `${libelleAnnee(a.annee)} : IR ${dh(a.ir * m)}`).join(', '));
}

function rendreTableau(s, m) {
  const net = s.base.avecNet ? 'Net' : 'Après IR';
  let html = `<thead><tr><th>Année</th><th>IR</th><th>${net}</th><th>Gain vs actuel</th><th>Gain vs année préc.</th><th>Taux moyen</th><th>Taux marginal</th></tr></thead><tbody>`;
  for (const a of s.annees) {
    html += `<tr class="${a.annee === 'actuel' ? 'actuel' : ''}"><td><strong>${libelleAnnee(a.annee)}</strong></td>
      <td>${dh(a.ir * m)}</td><td>${dh(a.net * m)}</td>
      <td class="${a.gainVsActuel > 0.005 ? 'pos' : ''}">${a.annee === 'actuel' ? '—' : signe(a.gainVsActuel * m)}</td>
      <td class="${a.gainVsPrecedente > 0.005 ? 'pos' : ''}">${a.annee === 'actuel' ? '—' : signe(a.gainVsPrecedente * m)}</td>
      <td>${pct(a.tauxMoyen)}</td><td>${pct(a.tauxMarginal)}</td></tr>`;
  }
  html += `</tbody><tfoot><tr><td>Cumul 2027–2031</td><td colspan="2"></td><td class="pos">${signe(s.gainCumule)}</td><td colspan="3" style="text-align:left;font-weight:400;color:var(--muted)">sur 5 ans, 12 mois par an</td></tr></tfoot>`;
  $('tableau').innerHTML = html;
}

function rendreBase(s) {
  const b = s.base;
  $('blocBase').hidden = !b.avecNet;
  if (!b.avecNet) return;
  let html = `<tbody><tr><td>Salaire brut</td><td>${dh(+etat.brut || 0, true)}</td></tr>`;
  for (const l of b.lignes) {
    const tag = l.deductible ? '' : ' <small>non déductible</small>';
    html += `<tr><td>${l.libelle}${l.note && l.deductible ? `<small>${l.note}</small>` : ''}${tag}</td><td class="neg">−${dh(l.montant, true)}</td></tr>`;
  }
  html += `</tbody><tfoot><tr><td>Revenu net imposable</td><td>${dh(b.rni, true)} <small>/ mois</small></td></tr></tfoot>`;
  $('retenues').innerHTML = html;
  let note = 'Les frais professionnels réduisent la base imposable mais ne sont pas prélevés sur votre salaire.';
  if (b.origine === 'bulletin') {
    note = `Revenu imposable retrouvé à partir de l'IR du bulletin (${dh(+etat.irBulletin, true)}). Calculé à partir du brut, on obtiendrait ${dh(b.rniCalcule, true)} — l'écart correspond généralement aux indemnités exonérées.`;
  }
  $('noteBase').textContent = note;
}

function rendreDetail(s) {
  $('choixAnnee').innerHTML = ANNEES.map((a) => `<button role="tab" data-annee="${a}" aria-selected="${a === etat.anneeDetail}">${libelleAnnee(a)}</button>`).join('');
  const annuel = s.base.rni * 12;
  const { total, detail } = impotParTranche(annuel, etat.anneeDetail);
  const red = Math.min(total, reductionFamille(etat.personnes));
  let html = '<thead><tr><th>Tranche annuelle</th><th>Taux</th><th>Base</th><th>Impôt</th></tr></thead><tbody>';
  for (const d of detail) {
    html += `<tr><td>${k(d.bas)} → ${k(d.haut)}</td><td>${pct(d.taux)}</td><td>${dh(d.base)}</td><td>${dh(d.impot, true)}</td></tr>`;
  }
  html += '</tbody><tfoot>';
  if (red > 0) html += `<tr><td colspan="3" style="font-weight:400">Réduction charges de famille <small>${etat.personnes} × 500 DH</small></td><td class="pos">−${dh(red, true)}</td></tr>`;
  html += `<tr><td colspan="3">IR annuel ${libelleAnnee(etat.anneeDetail) === 'Actuel' ? '(barème actuel)' : libelleAnnee(etat.anneeDetail)} <small>soit ${dh((total - red) / 12, true)} / mois</small></td><td>${dh(total - red, true)}</td></tr></tfoot>`;
  $('detail').innerHTML = html;
}

function rendreBareme(s) {
  const annuel = s.base.rni * 12;
  let html = `<thead><tr><th>Tranche (DH/an)</th>${ANNEES.map((a) => `<th>${libelleAnnee(a)}</th>`).join('')}</tr></thead><tbody>`;
  for (let i = 0; i < GRILLE.length - 1; i++) {
    const bas = GRILLE[i], haut = GRILLE[i + 1];
    const moi = annuel > bas && annuel <= haut || (i === 0 && annuel === 0);
    const cells = ANNEES.map((a) => {
      const taux = BAREMES[a].find(([p]) => haut <= p)[1];
      return `<td class="${taux === 0 ? 'zero' : ''}">${taux === 0 ? '0 %' : pct(taux)}</td>`;
    }).join('');
    const libelle = haut === Infinity ? `> ${nf.format(bas)}` : `${nf.format(bas)} → ${nf.format(haut)}`;
    html += `<tr class="${moi ? 'moi' : ''}"><td>${libelle}</td>${cells}</tr>`;
  }
  $('bareme').innerHTML = html + '</tbody>';
}

// ---------- Événements ----------
function lier() {
  for (const c of CHAMPS) {
    const el = $(c);
    el.value = etat[c] || '';
    el.addEventListener('input', () => { etat[c] = Math.max(0, parseFloat(el.value.replace(',', '.')) || 0); rendre(); });
  }
  document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { etat.mode = b.dataset.mode; rendre(); }));
  document.querySelectorAll('[data-periode]').forEach((b) => b.addEventListener('click', () => { etat.periode = b.dataset.periode; rendre(); }));
  $('plus').addEventListener('click', () => { etat.personnes = Math.min(6, etat.personnes + 1); rendre(); });
  $('moins').addEventListener('click', () => { etat.personnes = Math.max(0, etat.personnes - 1); rendre(); });
  $('choixAnnee').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-annee]');
    if (!b) return;
    etat.anneeDetail = b.dataset.annee === 'actuel' ? 'actuel' : +b.dataset.annee;
    rendre();
  });
  $('partager').addEventListener('click', async () => {
    const url = lienPartage();
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: 'Simulateur IR Maroc 2027–2031', url });
      } else {
        await navigator.clipboard.writeText(url);
        toast('Lien copié');
      }
    } catch { /* partage annulé */ }
  });
}

let minuteur;
function toast(texte) {
  const t = $('toast');
  t.textContent = texte;
  t.classList.add('show');
  clearTimeout(minuteur);
  minuteur = setTimeout(() => t.classList.remove('show'), 1800);
}

charger();
lier();
rendre();
let tailleChart = $('chart').clientWidth;
addEventListener('resize', () => { if ($('chart').clientWidth !== tailleChart) { tailleChart = $('chart').clientWidth; rendre(); } });
if (location.search) history.replaceState(null, '', location.pathname);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
