// Moteur de calcul de l'impôt sur le revenu (IR) au Maroc.
// Barème en vigueur + trajectoire 2027 → 2031 du PLF 2027 (n° 60.26).
// Module pur, sans DOM : utilisé par l'interface et par les tests.

export const ANNEES = ['actuel', 2027, 2028, 2029, 2030, 2031];
export const ANNEES_REFORME = ANNEES.slice(1);

// Chaque barème : liste de [plafond annuel (DH), taux]. Dernier plafond = Infinity.
export const BAREMES = {
  actuel: [[40000, 0], [60000, 0.10], [80000, 0.20], [100000, 0.30], [180000, 0.34], [Infinity, 0.37]],
  2027: [[60000, 0], [80000, 0.10], [100000, 0.20], [180000, 0.34], [Infinity, 0.37]],
  2028: [[60000, 0], [100000, 0.10], [200000, 0.25], [Infinity, 0.37]],
  2029: [[60000, 0], [130000, 0.10], [200000, 0.20], [Infinity, 0.35]],
  2030: [[60000, 0], [150000, 0.10], [200000, 0.20], [Infinity, 0.30]],
  2031: [[60000, 0], [150000, 0.10], [500000, 0.20], [Infinity, 0.30]],
};

// Découpage commun pour comparer tous les barèmes sur une même grille.
export const GRILLE = [0, 40000, 60000, 80000, 100000, 130000, 150000, 180000, 200000, 500000, Infinity];

export const FAMILLE_PAR_PERSONNE = 500; // DH / an
export const FAMILLE_MAX_PERSONNES = 6;

export const CNSS = { taux: 0.0448, plafondMensuel: 6000 };
export const AMO_TAUX = 0.0226;
export const FRAIS_PRO = { seuilAnnuel: 78000, tauxBas: 0.35, tauxHaut: 0.25, plafondAnnuel: 35000 };

const positif = (x) => (Number.isFinite(+x) && +x > 0 ? +x : 0);
export const libelleAnnee = (a) => (a === 'actuel' ? 'Actuel' : String(a));

/** Taux de la tranche dans laquelle tombe le dernier dirham. */
export function tauxMarginal(annee, revenuAnnuel) {
  const r = positif(revenuAnnuel);
  for (const [plafond, taux] of BAREMES[annee]) if (r <= plafond) return taux;
  return 0;
}

export function reductionFamille(personnes) {
  const n = Math.min(FAMILLE_MAX_PERSONNES, Math.max(0, Math.floor(positif(personnes))));
  return n * FAMILLE_PAR_PERSONNE;
}

/** IR annuel avant réduction familiale, avec le détail par tranche. */
export function impotParTranche(revenuAnnuel, annee) {
  const r = positif(revenuAnnuel);
  const detail = [];
  let bas = 0;
  let total = 0;
  for (const [plafond, taux] of BAREMES[annee]) {
    const base = Math.max(0, Math.min(r, plafond) - bas);
    const impot = base * taux;
    detail.push({ bas, haut: plafond, taux, base, impot });
    total += impot;
    if (r <= plafond) break;
    bas = plafond;
  }
  return { total, detail };
}

export function irAnnuel(revenuAnnuel, annee, personnes = 0) {
  return Math.max(0, impotParTranche(revenuAnnuel, annee).total - reductionFamille(personnes));
}

export function irMensuel(rniMensuel, annee, personnes = 0) {
  return irAnnuel(positif(rniMensuel) * 12, annee, personnes) / 12;
}

/** Retrouve le revenu net imposable mensuel qui produit un IR mensuel donné (barème actuel). */
export function rniDepuisIr(irConnu, personnes = 0, annee = 'actuel') {
  const cible = positif(irConnu);
  if (!cible) return 0;
  let bas = 0;
  let haut = 20000;
  while (irMensuel(haut, annee, personnes) < cible) haut *= 2;
  for (let i = 0; i < 80; i++) {
    const milieu = (bas + haut) / 2;
    if (irMensuel(milieu, annee, personnes) < cible) bas = milieu;
    else haut = milieu;
  }
  return (bas + haut) / 2;
}

export function fraisProfessionnels(brutMensuel) {
  const brut = positif(brutMensuel);
  const taux = brut * 12 <= FRAIS_PRO.seuilAnnuel ? FRAIS_PRO.tauxBas : FRAIS_PRO.tauxHaut;
  return { taux, montant: Math.min(brut * taux, FRAIS_PRO.plafondAnnuel / 12) };
}

export const ENTREES_DEFAUT = {
  mode: 'prive', // 'prive' | 'public' | 'rni'
  brut: 10000,
  personnes: 0,
  cimr: 0, // % salarial
  cmr: 0,
  amo: 0,
  mutuelles: 0,
  autres: 0,
  irBulletin: 0,
  rni: 8000,
};

/**
 * Du brut au revenu net imposable (RNI) mensuel.
 * Retourne aussi les retenues prélevées sur le salaire (hors IR) et leur détail.
 */
export function baseImposable(e) {
  if (e.mode === 'rni') {
    return { rni: positif(e.rni), retenues: 0, lignes: [], origine: 'saisie', avecNet: false };
  }
  const brut = positif(e.brut);
  const lignes = [];
  if (e.mode === 'prive') {
    lignes.push({ libelle: 'CNSS', note: '4,48 % plafonnée à 6 000 DH', montant: Math.min(brut, CNSS.plafondMensuel) * CNSS.taux, deductible: true, prelevee: true });
    lignes.push({ libelle: 'AMO', note: '2,26 % du brut', montant: brut * AMO_TAUX, deductible: true, prelevee: true });
    const cimr = brut * positif(e.cimr) / 100;
    if (cimr) lignes.push({ libelle: 'CIMR', note: `${String(positif(e.cimr)).replace('.', ',')} % du brut`, montant: cimr, deductible: true, prelevee: true });
  } else {
    const ajout = (libelle, montant, deductible, note) => {
      if (positif(montant)) lignes.push({ libelle, note, montant: positif(montant), deductible, prelevee: true });
    };
    ajout('CMR (retraite)', e.cmr, true);
    ajout('AMO', e.amo, true);
    ajout('Mutuelles', e.mutuelles, true);
    ajout('Autres retenues', e.autres, false, 'non déductibles');
  }
  const fp = fraisProfessionnels(brut);
  lignes.push({ libelle: 'Frais professionnels', note: `${Math.round(fp.taux * 100)} %, plafond 35 000 DH/an`, montant: fp.montant, deductible: true, prelevee: false });

  const deductions = lignes.filter((l) => l.deductible).reduce((s, l) => s + l.montant, 0);
  const retenues = lignes.filter((l) => l.prelevee).reduce((s, l) => s + l.montant, 0);
  const rniCalcule = Math.max(0, brut - deductions);

  if (e.mode === 'public' && positif(e.irBulletin)) {
    return { rni: rniDepuisIr(e.irBulletin, e.personnes), retenues, lignes, origine: 'bulletin', avecNet: true, rniCalcule };
  }
  return { rni: rniCalcule, retenues, lignes, origine: 'calcul', avecNet: true };
}

/** Simulation complète : une ligne par année (actuel, 2027 … 2031). */
export function simuler(e) {
  const base = baseImposable(e);
  const brut = positif(e.brut);
  const irActuel = base.origine === 'bulletin' ? positif(e.irBulletin) : irMensuel(base.rni, 'actuel', e.personnes);
  let precedent = irActuel;
  const annees = ANNEES.map((annee) => {
    const ir = annee === 'actuel' ? irActuel : irMensuel(base.rni, annee, e.personnes);
    const ligne = {
      annee,
      ir,
      net: base.avecNet ? brut - base.retenues - ir : base.rni - ir,
      gainVsActuel: irActuel - ir,
      gainVsPrecedente: annee === 'actuel' ? 0 : precedent - ir,
      tauxMoyen: base.rni > 0 ? ir / base.rni : 0,
      tauxMarginal: tauxMarginal(annee, base.rni * 12),
    };
    precedent = ir;
    return ligne;
  });
  const gainCumule = annees.slice(1).reduce((s, l) => s + l.gainVsActuel * 12, 0);
  return { base, annees, gainCumule, gainAnnuel2031: annees.at(-1).gainVsActuel * 12 };
}
