# Performance : exigences, budgets et mesures

Ce document définit les critères de performance du projet (critère 5 de `docs/bloc2.md`), justifie les seuils, et consigne les mesures réalisées le 9 octobre 2026.

## 1. Exigences à l'origine des seuils

| Exigence | Conséquence mesurable |
| --- | --- |
| Le jeu se joue sur téléphone, y compris en réseau mobile moyen (écran de 320 px de la recette). | Poids du client faible, affichage utile en quelques secondes. |
| Le dessin et les estimations sont partagés en direct entre 2 et 6 joueurs. | Latence des échanges Socket.IO faible : une action doit paraître immédiate. |
| Le service tourne sur une instance Render gratuite (512 Mo de mémoire, CPU partagé, mise en veille). | Plafond mémoire, nombre de parties simultanées borné, coût du premier chargement documenté. |

## 2. Budgets et justification

| Mesure | Seuil | Justification | Contrôle |
| --- | --- | --- | --- |
| JavaScript du client, compressé (gzip) | 130 Ko | Marge d'environ 35 % sur la valeur mesurée (95 Ko) : détecte l'ajout d'une dépendance lourde sans bloquer les évolutions normales. | CI, étape « Check client weight budget » du job `Build` (`npm run perf:budget`) |
| CSS du client, compressé (gzip) | 25 Ko | Marge d'environ 60 % sur la valeur mesurée (15 Ko). | idem |
| Image du client | 100 Ko | Les mascottes pèsent 53 à 77 Ko ; un fichier plus lourd retarde l'écran d'accueil. | idem |
| Latence d'un accusé Socket.IO, 95e centile, 20 salons de 6 joueurs en simultané | 500 ms | En dessous de 100 ms une action paraît instantanée ; jusqu'à 1 s le joueur garde le fil de son action (seuils d'interaction classiques). 500 ms laisse de la marge à un test où client et serveur partagent une machine. | Manuel, `npm run perf:load` |
| Délai de diffusion de l'état d'un salon, 95e centile, même charge | 500 ms | Même raisonnement : tous les joueurs doivent voir le lancement de la manche ensemble. | idem |
| Échecs pendant le test de charge | 0 | Aucune action légitime ne doit être refusée sous la charge cible. | idem |
| Mémoire du serveur sous la charge cible | 300 Mo | Moins de 60 % des 512 Mo de l'instance gratuite : laisse de la marge au système et aux pics. | Manuel (relevé) |
| Lighthouse mobile, performance | 70 | Référence « acceptable » ; le profil simulé (4G lente, processeur ralenti 4 fois) est volontairement sévère. | Manuel |
| Plus grand affichage (LCP) / décalage de mise en page (CLS) | 3 s / 0,1 | Seuils « bon » à « à améliorer » des indicateurs web essentiels, CLS au seuil « bon ». | Manuel |

**Charge cible : 20 salons de 6 joueurs en simultané (120 joueurs).** Le jeu est destiné à des groupes d'amis sur une instance unique : cette cible est déjà bien au-dessus de l'usage prévu. La charge de 60 salons (360 joueurs) est mesurée pour connaître la limite, pas pour la garantir.

## 3. Mesures

Environnement : poste Windows, Node 22.12.0, serveur de production local (`npm run build && npm start`), client et serveur sur la même machine. Les valeurs de latence sont donc optimistes pour le réseau et pessimistes pour le CPU (le générateur de charge consomme aussi du processeur).

### Poids du client

| Fichier | Brut | Transféré (compressé) |
| --- | --- | --- |
| JavaScript | 330,6 Ko | 98,3 Ko (95 Ko en gzip) |
| CSS | 82,0 Ko | 17,3 Ko (15 Ko en gzip) |
| Mascottes de l'accueil (2 images) | 2 x 55 Ko | 2 x 55 Ko (déjà compressées) |
| Page d'accueil, total chargé par Lighthouse | | 226 Ko |

Sur Render, la compression est assurée par le frontal du service : le JavaScript y est servi en Brotli (99 Ko transférés, mesuré sur `https://drawing-scale-game.onrender.com/`). Le serveur applicatif ne compresse donc pas lui-même : une dépendance supplémentaire n'apporterait rien en production.

### Lighthouse (mobile simulé, serveur de production local)

| Indicateur | Résultat |
| --- | --- |
| Performance | 78 |
| Accessibilité | 100 |
| Bonnes pratiques | 100 |
| Premier affichage (FCP) | 1,4 s |
| Plus grand affichage (LCP) | 2,6 s (image de mascotte) |
| Temps de blocage total (TBT) | 740 ms |
| Décalage de mise en page (CLS) | 0 |

Le score de performance respecte le seuil de 70, le LCP et le CLS respectent leurs seuils. **Le TBT de 740 ms est supérieur à la valeur « bonne » (200 ms)** : l'exécution du JavaScript au chargement coûte environ 0,7 s sur le profil ralenti. Lighthouse estime aussi 54 Ko de JavaScript non utilisé au premier affichage et 97 Ko d'économie possible avec des images dans un format moderne. Ces pistes ne sont pas traitées dans ce lot (voir section 5).

### Charge Socket.IO

`npm run perf:load` (script `scripts/load-test.mjs`) fait jouer à N salons de 6 joueurs le début d'une manche : création, jonction, état prêt, lancement, envoi d'un dessin d'environ 1 500 points, estimations. Les salons démarrent tous en même temps (rafale).

| Charge | Échecs | Accusé p50 | Accusé p95 | Diffusion p95 |
| --- | --- | --- | --- | --- |
| 3 salons (18 joueurs) | 0 | 6 ms | 33 ms | 8 ms |
| 20 salons (120 joueurs), 3 essais | 0 | 16 à 37 ms | 205 à 262 ms | 16 à 28 ms |
| 60 salons (360 joueurs) | 0 | 46 ms | 499 ms | 48 ms |

La charge cible respecte le budget sur les trois essais. À 60 salons, le 95e centile des accusés atteint le seuil (499 ms contre 500 ms, et un essai à 20 salons a franchi 250 ms) : c'est l'ordre de grandeur de la limite d'une instance unique avec une rafale simultanée.

Mémoire du processus serveur : 62 Mo au repos, 186 Mo après trois passages de 20 salons (360 connexions cumulées), sous le plafond de 300 Mo. Le relevé n'a pas été fait sur Render.

### Premier chargement sur Render

Mesure sur `https://drawing-scale-game.onrender.com/` :

| Cas | Durée |
| --- | --- |
| Première requête après mise en veille | **23 s** |
| Requêtes suivantes (`/api/health`) | 0,16 s |

L'instance gratuite de Render s'arrête après une période d'inactivité et redémarre à la première requête. Ce délai de 23 s est le principal défaut de performance perçu. Il n'est pas corrigeable dans le code ; il l'est par le plan du service (instance payante, toujours active) ou par un appel périodique externe, ce qui relève d'une décision du porteur du projet (voir section 5).

## 4. Corrections apportées

- Les fichiers de `/assets` (nom contenant un hash) sont servis avec `Cache-Control: public, max-age=31536000, immutable`, les mascottes avec `max-age=86400`. Avant, tout était servi avec `max-age=0` : chaque visite faisait revalider 330 Ko de JavaScript. Lighthouse signale encore les deux mascottes de l'accueil (durée de cache de un jour, jugée courte) : les images ne portent pas de hash et ne peuvent pas être mises en cache plus longtemps sans risque de version périmée.
- Un budget de poids est vérifié à chaque PR par le job `Build` : le poids du client ne peut plus augmenter sans qu'un seuil le signale.

## 5. Limites et décisions à prendre

- **Mise en veille de Render (23 s)** : choisir entre l'accepter (et le dire aux joueurs), un plan payant ou un appel périodique.
- **Pistes de gain non traitées** : conversion des mascottes en WebP/AVIF (environ 100 Ko), découpage du JavaScript par écran (environ 54 Ko), pour améliorer le TBT. À traiter si la validation par des utilisateurs révèle une lenteur ressentie.
- **Mesures sur le réseau réel** : les latences ci-dessus sont locales. Une mesure depuis un téléphone sur le service Render reste à faire.
- **Lighthouse et mémoire** ne sont pas contrôlés en CI : ils dépendent de la machine et rendraient la CI instable.

## 6. Refaire les mesures

```bash
npm run build
npm run perf:budget                 # poids du client (exécuté en CI)
PORT=3499 npm start                 # dans un autre terminal
npm run perf:load -- http://localhost:3499 20
```

Lighthouse : `npx lighthouse http://localhost:3499/ --only-categories=performance` (profil mobile par défaut).
