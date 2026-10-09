# Cadrage BLOC 2

Source : onglet `Grille Eval Bloc 2` du fichier `docs/context/Grille_evaluation_RNCP39583.xlsx`.

Statuts utilisés : **Disponible** quand une preuve existe et a été vérifiée dans ce dépôt, **Partiel** quand une première preuve existe mais ne couvre pas encore le critère, **À produire** quand aucune preuve suffisante n’existe. Aucun statut ne vaut validation du jury.

## Matrice des 26 critères

| # | Compétence | Critère exact | Preuve disponible | Statut réel | Action restante |
| ---: | --- | --- | --- | --- | --- |
| 1 | C2.1.1 | Le protocole de déploiement continu est explicité. | README : CI sur `develop`, déclenchement Render attendu après contrôles, vérification post-déploiement et rollback. | Partiel | Commit `cae3504` vérifié en ligne et réglages Render consultés. Prouver un déploiement automatique sans déclenchement manuel, puis exécuter le rollback sur un incident contrôlé. |
| 2 | C2.1.1 | L'environnement de développement est détaillé (ex : éditeur de code, compilateur, etc.). | README : Node, npm, Vite, TypeScript et commandes locales ; installation reproduite dans un clone propre extérieur ; fins de ligne figées par `.gitattributes` et contrôle de format vérifié sur un clone Windows (`autocrlf=true`). | Partiel | Ajouter les prérequis système et vérifier le parcours sur un poste vierge distinct. |
| 3 | C2.1.1 | Les outils mobilisés permettent d’identifier les composants comme : le compilateur, le serveur d’application, les outils de gestion de sources. | README et manifests : TypeScript, Express/Socket.IO et Git/GitHub. | Disponible | Maintenir les versions et les responsabilités à jour. |
| 4 | C2.1.1 | Le protocole permet de définir les différentes séquences de déploiement. | Séquence `PR → CI → fusion develop → CI du merge → Render → recette` documentée ; CI du merge et recette publique exécutées ; promotion `main` différée. | Partiel | Vérifier dans Render le déclenchement du déploiement et produire la preuve du commit servi. |
| 5 | C2.1.1 | Les critères de qualité et de performance permettent de répondre aux exigences du projet. | CI distincte : formatage, lint, typecheck, build, audit et synthèse stricte, tous réussis sur la PR #2. | Partiel | Définir les budgets de performance, les mesurer et justifier les seuils. |
| 6 | C2.1.2 | Le protocole d’intégration continue est explicité clairement. | README, `.github/workflows/ci.yml`, jobs distincts et exécution vérifiée sur la PR #2. | Disponible | Compléter lors de l’ajout des suites unitaires et E2E. |
| 7 | C2.1.2 | Il permet de définir les séquences d’intégration. | PR #2 vers `develop`, contrôles requis distincts, synthèse `Quality`, puis CI réussie sur le commit fusionné. | Disponible | Conserver les noms de contrôles et vérifier les protections à chaque évolution. |
| 8 | C2.2.1 | Les bonnes pratiques de développement sont respectées (ex : utilisation de framework, paradigmes de développement, …). | Monorepo TypeScript strict, React, Express, Socket.IO, contrats partagés et serveur autoritaire ; revue ciblée et corrections prioritaires au commit `08dee98a123b0e6e0234a4c3be7e76e655491221`. | Partiel | Compléter la revue par les suites prévues, la mesure de couverture et les audits dédiés. |
| 9 | C2.2.1 | Le prototype est fonctionnel et il permet de répondre aux besoins identifiés. | Application reprise, build et vérification initiale consignés dans `docs/validation.md`. | Partiel | Étendre la recette à tous les parcours et faire valider par des utilisateurs. |
| 10 | C2.2.1 | Le prototype met en œuvre un ensemble cohérent de fonctionnalités principales du logiciel et les user stories. | Besoins et 27 user stories rédigés à partir du jeu existant dans `docs/recette.md`, reliés à des scénarios de recette. | Partiel | Faire valider les user stories par le porteur du projet ; exécuter les scénarios associés (étapes 2, 3 et 9). |
| 11 | C2.2.1 | Les composants de l’interface sont présents et fonctionnels. (ex : fenêtres, boutons, menus, …) | Composants React, règles Biome React/accessibilité réactivées et recette complète à trois sessions sans erreur navigateur. | Partiel | Compléter par les usages clavier, lecteur d'écran, contraste et états d'erreur hors parcours nominal. |
| 12 | C2.2.1 | Le prototype permet de satisfaire aux exigences de sécurité. | Validation serveur des commandes, secrets séparés, origine WebSocket contrôlée, en-têtes navigateur, audit des dépendances à 0 vulnérabilité, modèle de menace et quotas implémentés (`docs/securite.md`, tests unitaires `npm run test:unit`, contre-vérification des quotas). | Partiel | Confirmer les quotas par la suite permanente et l'audit OWASP ; choisir la mesure de la taille maximale réelle d'un dessin. |
| 13 | C2.2.2 | Les tests unitaires couvrent la majorité du code développé. | Premiers tests unitaires permanents : débit, fenêtres, adresse IP, quotas d'accès, bornes de salon, fermeture des salons inactifs (`server/test`, 13 réussis). | Partiel | Étendre aux règles de jeu et aux validations, puis mesurer la couverture sur un périmètre explicite incluant les fichiers non exécutés. |
| 14 | C2.2.3 | Les mesures prises permettent de couvrir les 10 failles de sécurité principales décrites par l’OWASP. | Validations et autorisations serveur, origine WebSocket, CSP/en-têtes de sécurité et audit des dépendances existent ; il ne s'agit pas d'un audit OWASP complet. | Partiel | Retenir et dater une édition OWASP Top 10, analyser chacune des dix catégories, corriger puis conserver les preuves. |
| 15 | C2.2.3 | Le référentiel d’accessibilité choisi est présenté et justifié. (ex : RGAA, OPQUAST, etc.) | Aucun référentiel arrêté dans ce lot. | À produire | Choisir un référentiel adapté au jeu web, justifier le choix et définir le périmètre de vérification. |
| 16 | C2.2.3 | Le prototype permet de répondre aux exigences du référentiel d’accessibilité préalablement établi. | Quelques attributs sémantiques sont présents, sans audit complet. | À produire | Exécuter les contrôles automatiques et manuels du référentiel choisi, corriger et contre-tester. |
| 17 | C2.2.4 | Un système de gestion de versions est utilisé. | Dépôt Git et branches GitHub créés. | Disponible | Maintenir les protections et les références de PR. |
| 18 | C2.2.4 | Les évolutions du prototype sont tracées. | Historique Git propre et commit source historique identifié. | Disponible | Relier les lots, anomalies et validations aux commits et PR correspondants. |
| 19 | C2.2.4 | Le logiciel est fonctionnel et manipulable en autonomie par un utilisateur. | Clone autonome et recette publique complète à trois sessions, avec Socket.IO, restauration, revanche et départ. | Partiel | Identifier le commit Render servi et obtenir une validation utilisateur indépendante. |
| 20 | C2.3.1 | Le cahier de recettes reprend l’ensemble des fonctionnalités attendues. | Cahier de 40 scénarios dans `docs/recette.md`, avec résultats attendus et moyen de test ; 12 sont couverts par un test permanent réussi en CI, dont 8 entièrement. | Partiel | Automatiser ou exécuter les autres scénarios (étapes 2, 3, 5, 7, 8) et consigner les résultats (étape 9). |
| 21 | C2.3.1 | Les tests fonctionnels, structurels et de sécurité exécutés sont conformes au plan défini. | Plan de test défini dans `docs/recette.md` (fonctionnel, structurel, sécurité, accessibilité, déploiement) ; CI séparée, audit sans vulnérabilité, suite E2E et tests unitaires permanents. | Partiel | Exécuter l'ensemble du plan, conserver résultats, versions et écarts (étape 9). |
| 22 | C2.3.2 | Les bogues de codes sont détectés, qualifiés et traités. | `docs/validation.md` distingue défauts reproduits, risques étayés, améliorations et décisions, avec gravité, cause, correction et statut. | Partiel | Maintenir ce registre lors des suites E2E, unitaires et de la recette complète. |
| 23 | C2.3.2 | Une analyse des points d'amélioration est réalisée pour chaque test en échec. | Les échecs intermédiaires de recette/formatage sont analysés séparément des défauts applicatifs ; les constats retenus ont un résultat attendu. | Partiel | Appliquer la même qualification à chaque futur échec de CI, test ou recette. |
| 24 | C2.3.2 | Les corrections et les améliorations proposées sont conformes à l’attendu et garantissent le bon fonctionnement du logiciel. | Chaque correction du lot est reliée à un contre-test ciblé ; contrôles consolidés et partie complète à trois sessions réussis. | Partiel | Confirmer par les suites permanentes, les audits dédiés et la validation utilisateur. |
| 25 | C2.4.1 | Les manuels sont rédigés avec clarté. | README d’installation et d’architecture ; aucun manuel complet. | À produire | Rédiger et faire relire les manuels de déploiement, d’utilisation et de mise à jour. |
| 26 | C2.4.1 | La documentation permet de décrire les choix opérés en termes de technologies, de langages etc. | README et présente matrice. | Partiel | Documenter les décisions structurantes et leurs alternatives au fil des lots. |

## Plan d'exécution

Les étapes s'exécutent dans l'ordre. Chacune passe par une ou deux PR vers `develop` et met à jour la preuve correspondante. Les critères sont désignés par leur numéro dans la matrice.

| # | Étape | Critères | Livrable principal | Statut |
| ---: | --- | --- | --- | --- |
| 0 | Socle : plan consigné, `Unit tests` et `E2E` obligatoires | 7 | Protections de branche, `AGENTS.md` | Terminé |
| 1 | Besoins, user stories, squelette du cahier de recettes | 9, 10, 20, 21 | `docs/recette.md` | Terminé (user stories à valider) |
| 2 | Tests unitaires et couverture | 13, 24 | Tests des règles, validations, sessions ; couverture mesurée en CI | À faire |
| 3 | E2E complémentaires | 9, 11, 20, 24 | Refus, erreurs, expiration, bornes 2 et 6 joueurs, mobile et tablette | À faire |
| 4 | Audit OWASP Top 10:2025 | 12, 14 | Analyse par catégorie dans `docs/securite.md`, corrections | À faire |
| 5 | Accessibilité RGAA 4.1 AA | 11, 15, 16 | `docs/accessibilite.md`, audit, corrections | À faire |
| 6 | Performance | 1, 5 | `docs/performance.md`, mesures, seuils, contrôle en CI | À faire |
| 7 | Déploiement progressif | 1, 4, 17, 18, 19 | Préproduction `develop`, production `main`, rollback exécuté | À faire |
| 8 | Validation par des utilisateurs | 19, 22 | Fiche de retour, testeurs sur plusieurs appareils | À faire |
| 9 | Exécution complète du cahier de recettes | 21, 22, 23, 24 | Résultats, plan de correction des bogues, contre-tests | À faire |
| 10 | Manuels et décisions | 2, 8, 25, 26 | `docs/deploiement.md`, `docs/utilisation.md`, `docs/mise-a-jour.md`, `docs/decisions.md` | À faire |
| 11 | Bilan | tous | Matrice ajustée aux seules preuves exécutées | À faire |

Ce cadrage n'affirme pas que le BLOC 2 est complet. Les statuts ne progressent qu'avec des preuves réellement exécutées.
