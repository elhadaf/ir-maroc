# Simulateur IR Maroc 2027–2031

Application web (installable, fonctionne hors ligne) qui calcule l'**impôt sur le revenu** et le **salaire net** au Maroc avec le barème actuel, puis pour chaque année de la réforme **2027 → 2031** prévue par le projet de loi de finances 2027 (PLF n° 60.26).

**En ligne :** https://elhadaf.github.io/ir-maroc/

## Fonctionnalités

- **Salarié du privé** : à partir du brut mensuel — CNSS 4,48 % plafonnée à 6 000 DH, AMO 2,26 %, CIMR facultative, frais professionnels (35 % jusqu'à 78 000 DH/an de brut, sinon 25 %, plafond 35 000 DH/an).
- **Fonctionnaire** : à partir des retenues du bulletin (CMR, AMO, mutuelles, autres). Avec l'IR du bulletin, le revenu net imposable est retrouvé exactement.
- **Revenu imposable** : saisie directe du revenu net imposable mensuel.
- Charges de famille : 500 DH/an par personne, 6 au plus.
- Résultats par mois ou par an : IR, net, gain vs aujourd'hui et vs l'année précédente, gain cumulé sur 5 ans, taux moyen et marginal.
- Graphique, détail tranche par tranche, barèmes comparés avec votre tranche surlignée.
- Lien de partage, saisie mémorisée sur l'appareil. Aucune donnée envoyée.

> Le PLF 2027 n'est pas encore voté et peut être amendé : simulation indicative.

## Barèmes (taux par tranche de revenu net imposable annuel)

| Tranche (DH/an) | Actuel | 2027 | 2028 | 2029 | 2030 | 2031 |
|---|---|---|---|---|---|---|
| 0 → 40 000 | 0 | 0 | 0 | 0 | 0 | 0 |
| 40 001 → 60 000 | 10 % | 0 | 0 | 0 | 0 | 0 |
| 60 001 → 80 000 | 20 % | 10 % | 10 % | 10 % | 10 % | 10 % |
| 80 001 → 100 000 | 30 % | 20 % | 10 % | 10 % | 10 % | 10 % |
| 100 001 → 130 000 | 34 % | 34 % | 25 % | 10 % | 10 % | 10 % |
| 130 001 → 150 000 | 34 % | 34 % | 25 % | 20 % | 10 % | 10 % |
| 150 001 → 180 000 | 34 % | 34 % | 25 % | 20 % | 20 % | 20 % |
| 180 001 → 200 000 | 37 % | 37 % | 25 % | 20 % | 20 % | 20 % |
| 200 001 → 500 000 | 37 % | 37 % | 37 % | 35 % | 30 % | 20 % |
| > 500 000 | 37 % | 37 % | 37 % | 35 % | 30 % | 30 % |

Les barèmes sont dans [`js/ir.js`](js/ir.js). Les tests vérifient les gains année par année contre le tableau du PLF.

## Structure

Site statique sans dépendance ni étape de build : HTML, CSS et JavaScript (modules ES).

```
index.html            page
css/style.css         styles (clair / sombre)
js/ir.js              moteur de calcul (barèmes, paie, simulation)
js/app.js             interface
sw.js                 cache hors ligne
tests/ir.test.mjs     tests des calculs
```

## En local

```bash
npm test      # tests (Node ≥ 20)
npm start     # serveur local
```

## Mise en ligne

Le workflow `.github/workflows/pages.yml` lance les tests puis publie sur GitHub Pages à chaque push sur `main`.
Une seule fois : **Settings → Pages → Source : GitHub Actions**.
