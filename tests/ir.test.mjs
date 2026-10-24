import { test } from 'node:test';
import assert from 'node:assert/strict';
import { irMensuel, rniDepuisIr, simuler, ANNEES_REFORME, ENTREES_DEFAUT } from '../js/ir.js';

const r2 = (n) => Math.round(n * 100) / 100;

// PLF 2027 (n° 60.26) — tableau « Gain additionnel à chaque nouvelle année ».
// RNI mensuel → gains 2027/actuel, 2028/2027, 2029/2028, 2030/2029, 2031/2030.
const TABLEAU_PLF = [
  [3000, [0, 0, 0, 0, 0]],
  [4000, [66.67, 0, 0, 0, 0]],
  [5000, [166.67, 0, 0, 0, 0]],
  [6500, [316.67, 0, 0, 0, 0]],
  [7000, [366.67, 33.33, 0, 0, 0]],
  [8000, [466.67, 133.33, 0, 0, 0]],
  [8500, [500, 181.67, 25, 0, 0]],
  [10000, [500, 316.67, 250, 0, 0]],
  [11000, [500, 406.67, 383.33, 16.67, 0]],
  [12000, [500, 496.67, 433.33, 116.67, 0]],
  [15000, [500, 766.67, 583.33, 166.67, 0]],
  [16000, [500, 886.67, 633.33, 166.67, 0]],
  [17000, [500, 966.67, 673.33, 183.33, 33.33]],
  [20000, [500, 966.67, 733.33, 333.33, 333.33]],
  [25000, [500, 966.67, 833.33, 583.33, 833.33]],
  [30000, [500, 966.67, 933.33, 833.33, 1333.33]],
  [40000, [500, 966.67, 1133.33, 1333.33, 2333.33]],
  [50000, [500, 966.67, 1333.33, 1833.33, 2500]],
];

test('gains année par année conformes au tableau du PLF', () => {
  for (const [rni, attendus] of TABLEAU_PLF) {
    let prec = 'actuel';
    ANNEES_REFORME.forEach((annee, i) => {
      const gain = r2(irMensuel(rni, prec) - irMensuel(rni, annee));
      assert.ok(Math.abs(gain - attendus[i]) <= 0.011, `RNI ${rni}, ${annee} : ${gain} ≠ ${attendus[i]}`);
      prec = annee;
    });
  }
});

test('salarié du privé, brut 32 000 DH', () => {
  const s = simuler({ ...ENTREES_DEFAUT, mode: 'prive', brut: 32000 });
  // 32000 − CNSS 268,80 − AMO 723,20 − FP 2916,67
  assert.equal(r2(s.base.rni), 28091.33);
  assert.equal(r2(s.annees[0].ir), 8110.46);
  assert.equal(r2(s.annees[5].ir), 3868.27);
});

test('petit salaire : frais professionnels à 35 %', () => {
  const s = simuler({ ...ENTREES_DEFAUT, mode: 'prive', brut: 6000 });
  // 6000 − 268,80 − 135,60 − 2100
  assert.equal(r2(s.base.rni), 3495.6);
});

test('fonctionnaire : RNI retrouvé depuis l’IR du bulletin', () => {
  const rni = 34058.68;
  const ir = irMensuel(rni, 'actuel', 2);
  assert.ok(Math.abs(rniDepuisIr(ir, 2) - rni) < 0.01);
  const s = simuler({ ...ENTREES_DEFAUT, mode: 'public', brut: 41933.69, cmr: 2628.33, amo: 400, mutuelles: 180, autres: 30, irBulletin: 10318.38 });
  assert.equal(s.base.origine, 'bulletin');
  assert.equal(r2(s.base.rni), 34058.68);
  assert.equal(r2(s.annees[0].net), 28376.98);
});

test('charges de famille : 500 DH/an par personne, plafond 6, jamais négatif', () => {
  assert.equal(r2(irMensuel(10000, 'actuel', 0) - irMensuel(10000, 'actuel', 2)), 83.33);
  assert.equal(irMensuel(10000, 'actuel', 6), irMensuel(10000, 'actuel', 10));
  assert.equal(irMensuel(4000, 2027, 3), 0);
});
