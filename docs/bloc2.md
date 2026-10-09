# Cadrage BLOC 2

Source : onglet `Grille Eval Bloc 2` du fichier `docs/context/Grille_evaluation_RNCP39583.xlsx`.

Statuts utilisés : **Disponible** quand une preuve existe et a été vérifiée dans ce dépôt, **Partiel** quand une première preuve existe mais ne couvre pas encore le critère, **À produire** quand aucune preuve suffisante n’existe. Aucun statut ne vaut validation du jury.

## Matrice des 26 critères

| # | Compétence | Critère exact | Preuve disponible | Statut réel | Action restante |
| ---: | --- | --- | --- | --- | --- |
| 1 | C2.1.1 | Le protocole de déploiement continu est explicité. | README : CI sur `develop`, déclenchement Render attendu après contrôles, vérification post-déploiement et rollback. | Partiel | Commit `cae3504` vérifié en ligne et réglages Render consultés. Séquence préproduction/production, `scripts/smoke-check.mjs` et procédure de retour arrière rédigés dans `docs/deploiement-progressif.md`. Reste à exécuter : déploiement automatique observé sans déclenchement manuel, puis rollback. |
| 2 | C2.1.1 | L'environnement de développement est détaillé (ex : éditeur de code, compilateur, etc.). | README : Node, npm, Vite, TypeScript et commandes locales ; installation reproduite dans un clone propre extérieur ; fins de ligne figées par `.gitattributes` et contrôle de format vérifié sur un clone Windows (`autocrlf=true`). | Partiel | Prérequis système et procédure détaillés dans `docs/deploiement.md` ; reste à vérifier le parcours sur un poste vierge distinct. |
| 3 | C2.1.1 | Les outils mobilisés permettent d’identifier les composants comme : le compilateur, le serveur d’application, les outils de gestion de sources. | README et manifests : TypeScript, Express/Socket.IO et Git/GitHub. | Disponible | Maintenir les versions et les responsabilités à jour. |
| 4 | C2.1.1 | Le protocole permet de définir les différentes séquences de déploiement. | Séquence `PR → CI → fusion develop → CI du merge → Render → recette` documentée ; CI du merge et recette publique exécutées ; promotion `main` différée. | Partiel | `/api/health` expose désormais le commit servi (`RENDER_GIT_COMMIT`) et le contrôle `scripts/smoke-check.mjs` le compare au commit attendu. Reste à l'exécuter sur les deux services. |
| 5 | C2.1.1 | Les critères de qualité et de performance permettent de répondre aux exigences du projet. | CI distincte (formatage, lint, typecheck, build, audit, synthèse stricte) et `docs/performance.md` : exigences, budgets justifiés, mesures du 9 octobre 2026 (Lighthouse mobile 78, charge de 20 salons de 6 joueurs sans échec), contrôle du poids du client en CI. | Disponible | Mesurer depuis un téléphone sur Render ; décider du traitement de la mise en veille (23 s) et du TBT. |
| 6 | C2.1.2 | Le protocole d’intégration continue est explicité clairement. | README, `.github/workflows/ci.yml` : neuf contrôles distincts (formatage, lint, typecheck, build, audit, tests unitaires, E2E, synthèse, politique de branche), exécutés sur chaque PR et chaque push vers `develop` et `main`. | Disponible | Conserver les noms de contrôles stables. |
| 7 | C2.1.2 | Il permet de définir les séquences d’intégration. | PR vers `develop` avec neuf contrôles requis, synthèse `Quality`, CI sur le commit fusionné ; promotion `develop` vers `main` exécutée (PR #24). | Disponible | Vérifier les protections à chaque évolution. |
| 8 | C2.2.1 | Les bonnes pratiques de développement sont respectées (ex : utilisation de framework, paradigmes de développement, …). | Monorepo TypeScript strict, React, Express, Socket.IO, contrats partagés et serveur autoritaire ; lint et formatage Biome en CI ; 31 tests unitaires et 6 E2E ; audits OWASP, accessibilité et performance (`docs/securite.md`, `docs/accessibilite.md`, `docs/performance.md`) ; décisions tracées dans `docs/decisions.md`. | Disponible | Aucune revue de code par un tiers : à ajouter si le jury l’exige. |
| 9 | C2.2.1 | Le prototype est fonctionnel et il permet de répondre aux besoins identifiés. | Cahier de recettes exécuté le 9 octobre 2026 : 37 scénarios sur 44 réussis (`docs/recette.md`, section 5 ter) ; recette publique à trois sessions (`docs/validation.md`). | Partiel | Sessions de validation par des utilisateurs indépendants (`docs/validation-utilisateurs.md`). |
| 10 | C2.2.1 | Le prototype met en œuvre un ensemble cohérent de fonctionnalités principales du logiciel et les user stories. | Besoins et 27 user stories dans `docs/recette.md`, reliés à 44 scénarios dont 37 réussis. | Partiel | Faire valider les 27 user stories par le porteur du projet : elles sont rédigées à partir du jeu existant, sans cahier des charges préalable. |
| 11 | C2.2.1 | Les composants de l’interface sont présents et fonctionnels. (ex : fenêtres, boutons, menus, …) | Composants React testés par rendu (`client/test`), parcours E2E complets, contrôle axe-core sans violation, contrastes mesurés, parcours au clavier, aucun défilement horizontal à 320 px (`docs/accessibilite.md`). | Partiel | Lecteur d'écran, appareils tactiles réels et états d'erreur hors parcours nominal à vérifier. |
| 12 | C2.2.1 | Le prototype permet de satisfaire aux exigences de sécurité. | Modèle de menace et quotas, audit OWASP Top 10:2025 par catégorie, corrections (HSTS, source aléatoire cryptographique, journal de sécurité), tests d'intégration sur serveur réel et test de robustesse (`docs/securite.md`). | Disponible | Maintenir l'audit à chaque évolution ; les risques résiduels acceptés sont listés dans `docs/securite.md`. |
| 13 | C2.2.2 | Les tests unitaires couvrent la majorité du code développé. | 31 tests unitaires et d’intégration ; couverture mesurée à 75,0 % des lignes (9 537 sur 12 719) sur un périmètre incluant les fichiers jamais exécutés, avec un seuil de 70 % contrôlé en CI : serveur 85,4 %, composants React 80,0 %, partagé 100 %, client hors composants 44,0 % (`docs/recette.md`, section 5 bis). | Disponible | Le hook de session du client (environ 26 %) relève surtout de l’E2E ; deux fichiers de types sont exclus. |
| 14 | C2.2.3 | Les mesures prises permettent de couvrir les 10 failles de sécurité principales décrites par l’OWASP. | Audit des dix catégories de l'OWASP Top 10:2025 dans `docs/securite.md`, chacune avec ses mesures, sa preuve (test, commande ou fichier) et ses limites ; cinq corrections issues de l'audit. | Disponible | Aucun test d'intrusion externe : à compléter par une analyse dynamique si le jury l'exige. |
| 15 | C2.2.3 | Le référentiel d’accessibilité choisi est présenté et justifié. (ex : RGAA, OPQUAST, etc.) | RGAA 4.1 niveau AA (base WCAG 2.1 AA) choisi et justifié dans `docs/accessibilite.md`, avec périmètre, méthode et alternatives écartées. | Disponible | Vérifier la version officielle du RGAA sur Légifrance avant toute publication. |
| 16 | C2.2.3 | Le prototype permet de répondre aux exigences du référentiel d’accessibilité préalablement établi. | Audit exécuté sur chaque écran (axe-core, contrastes mesurés, 320 px, clavier), deux corrections, déclaration partielle et limites dans `docs/accessibilite.md`. | Partiel | Lecteur d'écran, texte à 200 %, appareils réels ; le dessin au clavier reste une non-conformité déclarée. |
| 17 | C2.2.4 | Un système de gestion de versions est utilisé. | Dépôt Git et branches GitHub créés. | Disponible | Maintenir les protections et les références de PR. |
| 18 | C2.2.4 | Les évolutions du prototype sont tracées. | Historique Git par fusions de PR (#2 à #27), commit source historique identifié, branches de travail préfixées, matrice et plan d’exécution dans ce document. | Disponible | Relier les anomalies et validations de `docs/validation.md` aux PR correspondantes. |
| 19 | C2.2.4 | Le logiciel est fonctionnel et manipulable en autonomie par un utilisateur. | Clone autonome et recette publique complète à trois sessions, avec Socket.IO, restauration, revanche et départ. | Partiel | Exécuter le contrôle du commit servi (`docs/deploiement-progressif.md`) et obtenir une validation utilisateur indépendante (protocole et seuils dans `docs/validation-utilisateurs.md`, aucune session à ce jour). |
| 20 | C2.3.1 | Le cahier de recettes reprend l’ensemble des fonctionnalités attendues. | Cahier de 44 scénarios dans `docs/recette.md`, avec résultats attendus, moyen de test et résultats consignés le 9 octobre 2026 (section 5 ter). | Disponible | Maintenir le cahier à chaque évolution de règle. |
| 21 | C2.3.1 | Les tests fonctionnels, structurels et de sécurité exécutés sont conformes au plan défini. | Plan défini dans `docs/recette.md` ; cahier exécuté le 9 octobre 2026 : 37 scénarios sur 44 réussis (CI Node 22.12.0 ou essai manuel), 5 partiels, 2 non exécutés. | Partiel | Exécuter RC37 et RC39 (appareils réels, lecteur d’écran) et lever les cinq partiels. |
| 22 | C2.3.2 | Les bogues de codes sont détectés, qualifiés et traités. | Registre de `docs/validation.md` mis à jour le 9 octobre 2026 : 11 constats des étapes 0 à 11 avec catégorie, gravité, cause, correction, vérification et PR, plus les points non corrigés par décision. | Disponible | Ajouter les retours des testeurs (`docs/validation-utilisateurs.md`) et les futurs échecs. |
| 23 | C2.3.2 | Une analyse des points d’amélioration est réalisée pour chaque test en échec. | Chaque échec de CI de ce plan est analysé dans le registre de `docs/validation.md` (causes : script de test, mesure pendant une transition, attente non bornée, coupure pendant la montée en WebSocket), avec correction et vérification ; trois constats distinguent faux positif de test et défaut applicatif. | Disponible | Appliquer la même analyse à chaque futur échec. |
| 24 | C2.3.2 | Les corrections et les améliorations proposées sont conformes à l’attendu et garantissent le bon fonctionnement du logiciel. | Chaque correction est reliée à un contre-test ou à une vérification : contrôle de contraste validé par mutation, classement des ex æquo validé par mutation, test de reconnexion répété 18 fois sans échec, CI verte sur chaque PR. | Partiel | Confirmer par la validation utilisateur et les essais sur appareils réels. |
| 25 | C2.4.1 | Les manuels sont rédigés avec clarté. | `docs/deploiement.md`, `docs/utilisation.md`, `docs/mise-a-jour.md` et `docs/deploiement-progressif.md` rédigés le 9 octobre 2026 ; README mis à jour. | Partiel | Faire relire les manuels par une personne extérieure et suivre pas à pas `docs/deploiement.md` sur un poste vierge. |
| 26 | C2.4.1 | La documentation permet de décrire les choix opérés en termes de technologies, de langages etc. | `docs/decisions.md` : technologies, règles de jeu, sécurité, qualité et exploitation, avec alternatives et raisons ; décisions ouvertes listées. | Disponible | Ajouter une ligne à chaque décision structurante. |

## Bilan au 9 octobre 2026

| Statut | Nombre | Critères |
| --- | ---: | --- |
| Disponible | 15 | 3, 5, 6, 7, 8, 12, 13, 14, 15, 17, 18, 20, 22, 23, 26 |
| Partiel | 11 | 1, 2, 4, 9, 10, 11, 16, 19, 21, 24, 25 |
| À produire | 0 | |

Un statut « Disponible » signifie qu'une preuve a été exécutée et vérifiée dans ce dépôt ; il ne vaut pas validation du jury. Tous les critères « Partiel » attendent une action qui ne peut pas être réalisée par le code seul :

| Action restante | Critères concernés | Qui |
| --- | --- | --- |
| Observer un déploiement automatique sans clic manuel, exécuter `scripts/smoke-check.mjs` sur `game-preprod` et `game-prod` (URL de production à fournir), exécuter le retour arrière | 1, 4, 19 | Porteur du projet, dans Render |
| Organiser les sessions de validation avec au moins 6 testeurs indépendants (`docs/validation-utilisateurs.md`) | 9, 19, 22 | Porteur du projet |
| Valider les 27 user stories | 10 | Porteur du projet |
| Essais avec lecteur d'écran, texte à 200 %, téléphone et tablette réels (RC36, RC37, RC39, RC40) | 11, 16, 21 | Porteur du projet |
| Faire relire les manuels et suivre `docs/deploiement.md` sur un poste vierge | 2, 25 | Une personne extérieure |
| Vérifier la version officielle du RGAA avant de publier la déclaration d'accessibilité et en renseigner le contact | 15, 16 | Porteur du projet |

## Plan d'exécution

Les étapes s'exécutent dans l'ordre. Chacune passe par une ou deux PR vers `develop` et met à jour la preuve correspondante. Les critères sont désignés par leur numéro dans la matrice.

| # | Étape | Critères | Livrable principal | Statut |
| ---: | --- | --- | --- | --- |
| 0 | Socle : plan consigné, `Unit tests` et `E2E` obligatoires | 7 | Protections de branche, `AGENTS.md` | Terminé |
| 1 | Besoins, user stories, squelette du cahier de recettes | 9, 10, 20, 21 | `docs/recette.md` | Terminé (user stories à valider) |
| 1 bis | Évolution du gameplay : dessin simultané, un dessin révélé à la fois, barème 0 à 2 points | 9, 10, 20 | Règles serveur, écrans, E2E, `docs/recette.md` | Terminé |
| 2 | Tests unitaires et couverture | 13, 24 | 31 tests regroupés par risque ; couverture mesurée à 75,0 % des lignes, seuil de 70 % contrôlé en CI | Terminé |
| 3 | E2E complémentaires | 9, 11, 20, 24 | 3 parcours : lien d'invitation et erreurs, partie à deux joueurs sur téléphone, coupure et expiration | Terminé (tablette non automatisée) |
| 4 | Audit OWASP Top 10:2025 | 12, 14 | Analyse par catégorie dans `docs/securite.md`, cinq corrections, test de robustesse | Terminé |
| 5 | Accessibilité RGAA 4.1 AA | 11, 15, 16 | `docs/accessibilite.md`, audit automatisé et clavier, deux corrections | Terminé (contrôles manuels restants listés) |
| 6 | Performance | 1, 5 | `docs/performance.md`, mesures, seuils, contrôle en CI | Terminé (mesures sur réseau réel restantes) |
| 7 | Déploiement progressif | 1, 4, 17, 18, 19 | Préproduction `develop`, production `main`, rollback exécuté | En cours (documents et script prêts, exécution sur Render à faire) |
| 8 | Validation par des utilisateurs | 19, 22 | Fiche de retour, testeurs sur plusieurs appareils | En cours (protocole et fiche prêts dans `docs/validation-utilisateurs.md`, sessions à organiser) |
| 9 | Exécution complète du cahier de recettes | 21, 22, 23, 24 | Résultats, plan de correction des bogues, contre-tests | Terminé (7 scénarios à lever avec des appareils réels, Render et l’accessibilité) |
| 10 | Manuels et décisions | 2, 8, 25, 26 | `docs/deploiement.md`, `docs/utilisation.md`, `docs/mise-a-jour.md`, `docs/decisions.md` | Terminé (relecture extérieure restante) |
| 11 | Bilan | tous | Matrice ajustée aux seules preuves exécutées, liste du reste à faire | Terminé |

Ce cadrage n'affirme pas que le BLOC 2 est complet. Les statuts ne progressent qu'avec des preuves réellement exécutées.
