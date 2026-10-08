# Cadrage BLOC 2

Source : onglet `Grille Eval Bloc 2` du fichier `docs/context/Grille_evaluation_RNCP39583.xlsx`.

Statuts utilisés : **Disponible** quand une preuve existe et a été vérifiée dans ce dépôt, **Partiel** quand une première preuve existe mais ne couvre pas encore le critère, **À produire** quand aucune preuve suffisante n’existe. Aucun statut ne vaut validation du jury.

## Matrice des 26 critères

| # | Compétence | Critère exact | Preuve disponible | Statut réel | Action restante |
| ---: | --- | --- | --- | --- | --- |
| 1 | C2.1.1 | Le protocole de déploiement continu est explicité. | README : séparation prévue entre validation, test et promotion stable. | Partiel | Définir et exécuter le déploiement de test, la vérification post-déploiement et le rollback. |
| 2 | C2.1.1 | L'environnement de développement est détaillé (ex : éditeur de code, compilateur, etc.). | README : Node, npm, Vite, TypeScript et commandes locales. | Partiel | Ajouter les prérequis système et vérifier le parcours sur un poste vierge. |
| 3 | C2.1.1 | Les outils mobilisés permettent d’identifier les composants comme : le compilateur, le serveur d’application, les outils de gestion de sources. | README et manifests : TypeScript, Express/Socket.IO et Git/GitHub. | Disponible | Maintenir les versions et les responsabilités à jour. |
| 4 | C2.1.1 | Le protocole permet de définir les différentes séquences de déploiement. | Séquences futures nommées dans le README. | Partiel | Implémenter les environnements et produire les journaux d’exécution. |
| 5 | C2.1.1 | Les critères de qualité et de performance permettent de répondre aux exigences du projet. | CI : formatage, lint, typecheck, build et audit. | Partiel | Définir les budgets de performance, les mesurer et justifier les seuils. |
| 6 | C2.1.2 | Le protocole d’intégration continue est explicité clairement. | README, `.github/workflows/ci.yml` et règles de branches. | Disponible | Compléter lors de l’ajout des suites unitaires et E2E. |
| 7 | C2.1.2 | Il permet de définir les séquences d’intégration. | PR de travail vers `develop`, puis promotion `develop` vers `main`, contrôlée par `Branch policy`. | Disponible | Conserver les noms de contrôles et vérifier les protections à chaque évolution. |
| 8 | C2.2.1 | Les bonnes pratiques de développement sont respectées (ex : utilisation de framework, paradigmes de développement, …). | Monorepo TypeScript strict, React, Express, Socket.IO, contrats partagés et serveur autoritaire. | Partiel | Produire une revue d’architecture et traiter les écarts prioritaires. |
| 9 | C2.2.1 | Le prototype est fonctionnel et il permet de répondre aux besoins identifiés. | Application reprise, build et vérification initiale consignés dans `docs/validation.md`. | Partiel | Étendre la recette à tous les parcours et faire valider par des utilisateurs. |
| 10 | C2.2.1 | Le prototype met en œuvre un ensemble cohérent de fonctionnalités principales du logiciel et les user stories. | Salons, joueurs, prêt, partie, dessin, estimation, révélation, classement, revanche et restauration présents dans le code repris. | Partiel | Relier chaque user story à un scénario de recette exécuté. |
| 11 | C2.2.1 | Les composants de l’interface sont présents et fonctionnels. (ex : fenêtres, boutons, menus, …) | Composants React et première recette navigateur. | Partiel | Vérifier systématiquement les états, dialogues, erreurs et usages clavier. |
| 12 | C2.2.1 | Le prototype permet de satisfaire aux exigences de sécurité. | Validation serveur des commandes, secrets séparés et limites de dessin ; audit des dépendances exécuté. | Partiel | Formaliser le modèle de menace et couvrir les risques identifiés. |
| 13 | C2.2.2 | Les tests unitaires couvrent la majorité du code développé. | Aucune nouvelle suite unitaire dans ce lot. | À produire | Définir un périmètre explicite, créer les tests utiles et mesurer honnêtement la majorité du code, fichiers non exécutés inclus. |
| 14 | C2.2.3 | Les mesures prises permettent de couvrir les 10 failles de sécurité principales décrites par l’OWASP. | Quelques validations serveur et un audit de dépendances existent. | Partiel | Retenir et dater une édition OWASP Top 10, analyser chacune des dix catégories, corriger puis conserver les preuves. |
| 15 | C2.2.3 | Le référentiel d’accessibilité choisi est présenté et justifié. (ex : RGAA, OPQUAST, etc.) | Aucun référentiel arrêté dans ce lot. | À produire | Choisir un référentiel adapté au jeu web, justifier le choix et définir le périmètre de vérification. |
| 16 | C2.2.3 | Le prototype permet de répondre aux exigences du référentiel d’accessibilité préalablement établi. | Quelques attributs sémantiques sont présents, sans audit complet. | À produire | Exécuter les contrôles automatiques et manuels du référentiel choisi, corriger et contre-tester. |
| 17 | C2.2.4 | Un système de gestion de versions est utilisé. | Dépôt Git et branches GitHub créés. | Disponible | Maintenir les protections et les références de PR. |
| 18 | C2.2.4 | Les évolutions du prototype sont tracées. | Historique Git propre et commit source historique identifié. | Disponible | Relier les lots, anomalies et validations aux commits et PR correspondants. |
| 19 | C2.2.4 | Le logiciel est fonctionnel et manipulable en autonomie par un utilisateur. | Démarrage et première recette consignés dans `docs/validation.md`. | Partiel | Obtenir des preuves d’utilisation autonome après déploiements progressifs. |
| 20 | C2.3.1 | Le cahier de recettes reprend l’ensemble des fonctionnalités attendues. | Liste fonctionnelle et recette initiale seulement. | À produire | Écrire un cahier unique couvrant toutes les fonctions, rôles, erreurs, restauration et frontières. |
| 21 | C2.3.1 | Les tests fonctionnels, structurels et de sécurité exécutés sont conformes au plan défini. | Contrôles structurels CI et recette initiale. | Partiel | Définir le plan complet, l’exécuter et conserver résultats, versions et écarts. |
| 22 | C2.3.2 | Les bogues de codes sont détectés, qualifiés et traités. | Anomalies du premier lot consignées dans `docs/validation.md`. | Partiel | Alimenter un registre à partir d’échecs réels avec sévérité, cause, correction et statut. |
| 23 | C2.3.2 | Une analyse des points d'amélioration est réalisée pour chaque test en échec. | Qualification de l’audit initial des dépendances. | Partiel | Appliquer cette analyse à chaque échec de recette et de CI. |
| 24 | C2.3.2 | Les corrections et les améliorations proposées sont conformes à l’attendu et garantissent le bon fonctionnement du logiciel. | Corrections limitées d’installation et de qualité, suivies de contre-vérifications. | Partiel | Relier chaque correction à son résultat attendu et à son contre-test. |
| 25 | C2.4.1 | Les manuels sont rédigés avec clarté. | README d’installation et d’architecture ; aucun manuel complet. | À produire | Rédiger et faire relire les manuels de déploiement, d’utilisation et de mise à jour. |
| 26 | C2.4.1 | La documentation permet de décrire les choix opérés en termes de technologies, de langages etc. | README et présente matrice. | Partiel | Documenter les décisions structurantes et leurs alternatives au fil des lots. |

## Lots suivants

1. **Améliorations applicatives nécessaires** : qualifier les écarts issus de la recette initiale, corriger uniquement les défauts avérés et consolider les exigences transversales.
2. **E2E regroupés** : automatiser peu de parcours complets à forte valeur, avec étapes partagées, restauration et départ représentatifs.
3. **Unitaires utiles** : couvrir les règles serveur, validations et transformations à risque ; mesurer la couverture sur un périmètre incluant les fichiers non exécutés, jusqu’à couvrir la majorité du code développé sans gonfler artificiellement la suite.
4. **Audits et recette** : choisir et vérifier le référentiel d’accessibilité, traiter séparément les dix catégories de l’édition OWASP retenue, exécuter le cahier de recettes complet et gérer les anomalies observées jusqu’au contre-test.
5. **Déploiement et manuels** : séparer validation, déploiement de test, vérification utilisateur, promotion stable et rollback ; produire les preuves d’exécution et les manuels de déploiement, d’utilisation et de mise à jour.

Ce cadrage n’affirme pas que le BLOC 2 est complet. Les statuts ne progressent qu’avec des preuves réellement exécutées.
