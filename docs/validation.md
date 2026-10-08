# Validation des lots

Ce document consolide les contrôles réellement exécutés au fil des lots. Chaque section précise la branche et le commit applicatif concernés ; un échec de scénario n'est qualifié de défaut applicatif qu'après analyse.

## Environnement

- Windows, PowerShell
- Node.js : `22.12.0`
- npm : `10.9.0`
- TypeScript : `7.0.2`
- Vite : `8.1.4`
- Biome : `2.5.15`
- Playwright : `1.64.0`
- Chromium : `156.0.8078.4`
- source applicative : `6af6c0fb0f4f1abdb914a63018526d71ac1dbffc`

## Contrôles exécutés

| Contrôle | Commande ou cible | Résultat observé |
| --- | --- | --- |
| Installation verrouillée | `npm ci` avec Node 22.12.0 et npm 10.9.0 | Réussie. |
| Formatage | `npm run format:check` | 85 fichiers vérifiés, aucune correction requise. |
| Lint | `npm run lint` | 75 fichiers applicatifs vérifiés, aucun diagnostic actif. |
| TypeScript | `npm run typecheck` | `shared`, `server` et `client` réussis ; aucune configuration de test appelée. |
| Build de production | `npm run build` | Build des trois workspaces réussi ; bundle client principal de 328,47 kB, 97,97 kB gzip. |
| Audit des dépendances | `npm audit` | 0 vulnérabilité après traitement ciblé. |
| Démarrage réel | `PORT=3100`, `NODE_ENV=production`, `npm start` | Serveur à l’écoute sur `0.0.0.0:3100`, client compilé servi avec HTTP 200. |
| Santé | `GET http://127.0.0.1:3100/api/health` | HTTP 200, `{"status":"ok","service":"drawing-game-server"}`. |

Le lint conserve les règles recommandées de Biome, avec une ligne de base explicitement désactivée pour les motifs historiques qui demandent un lot dédié : dépendances de hooks React, sémantique/accessibilité de certains composants, ordre de spécificité CSS et `!important` utilisé pour la réduction des animations. Les conversions sûres `Object.hasOwn` et `import type` ont été appliquées. Cette ligne de base ne constitue pas une preuve d’accessibilité.

## Recette navigateur initiale

Un scénario Playwright temporaire, non conservé dans le dépôt, a piloté le vrai serveur construit avec trois contextes Chromium indépendants.

Résultat final : **réussi en 37,0 secondes**.

- Alice crée un salon ; Bob et Chloe le rejoignent avec le code généré.
- Les trois joueurs se déclarent prêts et l’hôte lance la partie.
- Les six tours sont joués, soit deux manches complètes à trois joueurs.
- Chaque tour comprend le dessin vectoriel, sa confirmation, deux estimations confirmées, la révélation, les scores et la continuation par l’hôte.
- Une session non dessinatrice est rechargée pendant la première estimation. Le serveur restaure la session et le joueur poursuit la partie.
- Le classement final est affiché dans les trois sessions.
- L’hôte propose une revanche et les trois joueurs reviennent au lobby.
- Chloe quitte le lobby ; sa session revient à l’accueil et le lobby restant affiche deux joueurs.

Les deux premiers essais du scénario se sont arrêtés sur les dialogues de confirmation du dessin puis des estimations. Le scénario a été ajusté pour suivre ces étapes réelles de l’interface ; il ne s’agissait pas de défauts applicatifs.

## Anomalies observées et traitement

1. **Typecheck serveur bloqué.** `game-manager.ts` utilisait `cloneTurnScoreResult` sans import, tandis que la fonction restait privée dans `game-rules.ts`.
   - Qualification : erreur de compilation bloquante, limitée au code applicatif repris.
   - Correction : export ciblé de la fonction et import explicite dans le gestionnaire de partie.
   - Contre-test : typecheck et build complets réussis, puis partie navigateur complète réussie.
2. **Dépendances vulnérables dans le lockfile historique.** L’audit initial signalait 8 vulnérabilités : 2 modérées, 4 hautes et 2 critiques. Les dépendances de production concernées étaient `engine.io`, `proxy-addr` et `qs`. Les dépendances de développement ajoutaient notamment `shell-quote` via `concurrently`.
   - Qualification : risque de sécurité de chaîne d’approvisionnement, dont trois alertes affectaient l’arbre de production.
   - Correction : mises à jour transitives compatibles, suppression des dépendances de tests non reprises et remplacement de `concurrently` par un lanceur Node local sans dépendance.
   - Contre-test : installation, audit à 0 vulnérabilité, contrôles qualité, build, démarrage et recette réussis.
3. **Formatage non reproductible après un build.** La première commande globale de formatage incluait les répertoires `dist` une fois ceux-ci générés et rejetait leurs fichiers minifiés.
   - Qualification : défaut de ciblage du contrôle CI, sans effet sur le code exécuté.
   - Correction : chemins explicites limités aux sources et configurations suivies par Git.
   - Contre-test : `npm ci`, puis `npm run check` et `npm audit --audit-level=high` réussis avec les artefacts de build présents.

## Parcours non exécutés

- limites à quatre à huit joueurs et refus d’un neuvième joueur ;
- erreurs de saisie détaillées, doublons de pseudonyme et code de salon invalide ;
- expiration du délai de reconnexion et annulation de partie ;
- interruptions réseau répétées et reconnexion simultanée de plusieurs joueurs ;
- limites maximales du document de dessin et messages trop volumineux ;
- contrôles complets clavier, lecteur d’écran, contraste et réduction de mouvement ;
- tests structurels et de sécurité du futur cahier de recettes.

Ces parcours restent à intégrer aux lots E2E, accessibilité, sécurité et recette décrits dans `docs/bloc2.md`.

## Lot CI/CD et autonomie du dépôt — 8 octobre 2026

La branche `chore/ci-cd-render`, créée depuis le commit de fusion `develop` `4ee04aad0d8f70eec30f138231ec60a7123039d9`, introduit la CI séparée au commit `289dcdee67adad0a9a7977afe1840fedfbdf65b0`.

### CI et protections

- PR : [#2](https://github.com/GagaYaba/draw-game/pull/2).
- Exécution CI de la PR : [37767531874](https://github.com/GagaYaba/draw-game/actions/runs/37767531874), réussie le 8 octobre 2026.
- Jobs réussis : `Formatting`, `Lint`, `Typecheck`, `Build`, `Dependency audit`, `Branch policy` et synthèse `Quality`.
- Les protections de `develop` et `main` exigent ces sept contrôles, une branche à jour, une PR et la résolution des conversations. Elles s’appliquent aux administrateurs, sans approbation obligatoire, sans force-push ni suppression de branche protégée.
- Le workflow couvre désormais les PR et les pushes vers `develop` et `main`, ainsi que le déclenchement manuel.

### Clone autonome

Un clone propre de `draw-game` a été créé sous le répertoire temporaire Windows, hors de `rncp-game` et donc hors de tout dossier pouvant contenir `drawing-game`.

| Contrôle | Résultat observé |
| --- | --- |
| Liens symboliques suivis par Git | Aucun fichier de mode `120000`. |
| Dépendances de paquet externes | Aucun protocole `file:` ou `link:` ni chemin parent dans les manifests et le lockfile. |
| Runtime | Node `22.12.0`, npm `10.9.0`. |
| Installation | `npm ci` réussi, 133 paquets ajoutés, 0 vulnérabilité. |
| Formatage | 85 fichiers vérifiés, aucune correction requise. |
| Lint | 75 fichiers vérifiés, aucun diagnostic. |
| Typecheck | `shared`, `server` et `client` réussis. |
| Build | Trois workspaces réussis ; bundle client principal 328,47 kB, 97,97 kB gzip. |
| Audit | `npm audit --audit-level=high` réussi, 0 vulnérabilité. |
| Version construite | `npm start` avec `NODE_ENV=production` et un port temporaire : client HTTP 200. |
| Santé | HTTP 200, `{"status":"ok","service":"drawing-game-server"}`. |
| Socket.IO | Connexion WebSocket réelle, émission `client:ping` et réception `server:pong`. |

Une recette Playwright temporaire, non conservée dans le dépôt, a utilisé trois contextes Chromium indépendants sur ce clone. Résultat : **réussie en 34,1 secondes**.

- salon créé par Alice, rejoint par Bob et Chloe ; trois joueurs prêts et lancement par l’hôte ;
- six tours et deux manches complètes, avec l’ordre observé Chloe, Bob, Alice, Chloe, Bob, Alice ;
- dessin vectoriel, confirmation, deux estimations confirmées, révélation, scores et continuation à chaque tour ;
- session d’un votant restaurée après actualisation pendant la première estimation ;
- classement final « Victoire partagée » visible, revanche ramenant les trois sessions au lobby ;
- départ de Chloe, retour de sa session à l’accueil et lobby restant à deux joueurs.

### État public et accès Render avant fusion

L’URL `https://drawing-scale-game.onrender.com/` et `/api/health` répondent en HTTP 200. Le client servi référence les mêmes noms de bundles que le build local. Cette comparaison ne permet pas d’identifier le dépôt ni le commit réellement déployé.

Le dépôt local ne contient ni clé API Render, ni identifiant de service, ni deploy hook. Aucun navigateur connecté au compte Render n’était exposé à l’outil d’automatisation. La configuration effective du service, son commit déployé et le réglage **After CI Checks Pass** ne sont donc pas encore vérifiés indépendamment dans Render. Le lien vers `GagaYaba/draw-game` et la branche `develop` restent, à ce stade, l’état communiqué par le propriétaire du service. Aucun déploiement Render n’est déclaré exécuté dans cette section.

### Après fusion dans `develop`

- La PR #2 a été fusionnée au commit `4da5a7507cf211a40f525f392fbc731b179871d7`.
- La CI déclenchée par le push sur ce commit a réussi : [exécution 37768221983](https://github.com/GagaYaba/draw-game/actions/runs/37768221983). Les sept jobs attendus ont tous conclu `success`.
- `origin/main` est restée sur `a02b14bf05b28dbcec169da419c937c43466b50f` ; aucune promotion n’a été réalisée.
- La santé publique a répondu en HTTP 200 et une connexion Socket.IO réelle a reçu `server:pong` après `client:ping`.

La même recette temporaire a ensuite été exécutée sur `https://drawing-scale-game.onrender.com/` avec trois contextes indépendants. Le premier essai a été lancé avant l’établissement de Socket.IO et a reçu le message attendu « Connexion au serveur indisponible ». Le scénario a été corrigé pour attendre l’état connecté, puis a **réussi en 35,4 secondes** :

- Alice a créé le salon, rejoint par Bob et Chloe ;
- six tours et deux manches ont été joués, avec l’ordre observé Bob, Chloe, Alice, Bob, Chloe, Alice ;
- chaque tour a couvert dessin, confirmation, estimations, révélation, scores et continuation ;
- une session de votant a été restaurée après actualisation ;
- le classement final a annoncé « Victoire de Bob » ;
- la revanche a ramené les trois sessions au lobby, puis le départ de Chloe a laissé deux joueurs.

Cette réussite démontre le fonctionnement de l’instance publique observée, mais pas le commit qui la sert. Faute d’accès au tableau de bord ou à l’API Render, il reste impossible de confirmer que Render a déployé `4da5a7507cf211a40f525f392fbc731b179871d7`, de lire les commandes et variables effectives, ou de régler et prouver **After CI Checks Pass**. Ce blocage est distinct de la recette fonctionnelle réussie.

## Lot de corrections applicatives — 8 octobre 2026

La branche `fix/application-hardening` part du commit `develop` `5807a1c9748dfa68efee84493af75b28f91d8c77`. Les corrections applicatives contre-testées correspondent au commit `08dee98a123b0e6e0234a4c3be7e76e655491221`. La grille originale a été relue sans modification, principalement pour C2.2.1, C2.2.3 et C2.3.2. Aucun code, test, fixture, snapshot, harnais ou script de l'ancien dépôt n'a été consulté ou exécuté.

### Classement des constats

| Catégorie | Constat et preuve | Décision du lot |
| --- | --- | --- |
| Défaut reproduit — gravité modérée | Un handshake WebSocket portant `Origin: https://evil.example` était accepté par le serveur construit. Socket.IO ne disposait d'aucun `allowRequest`, donc la protection CORS du transport HTTP ne couvrait pas ce cas WebSocket. | Corrigé par une politique d'origine appliquée au handshake : même hôte par défaut, origines supplémentaires explicites, exception de ports limitée aux boucles locales de développement. |
| Risque étayé — gravité modérée | Le jeton de reprise est conservé côté navigateur, alors que les réponses Express n'imposaient ni CSP, ni anti-framing, ni `nosniff`, et exposaient la signature Express. Aucun point d'injection HTML n'a été trouvé, mais l'impact d'un futur XSS sur le jeton justifie une défense proportionnée. | Ajout d'une CSP compatible avec l'application et d'en-têtes `Permissions-Policy`, `Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options`; suppression de `X-Powered-By`. |
| Défaut reproduit — gravité faible | Les règles Biome réactivées signalaient des attributs ARIA non supportés sur cinq éléments, des regroupements non sémantiques et des SVG décoratifs indétectables à cause d'un spread. | Sémantique HTML et alternatives accessibles corrigées ; les quatre règles d'accessibilité passent désormais en erreur dans la configuration. Une seule exception locale reste justifiée pour rendre une liste horizontalement défilable atteignable au clavier. |
| Risque étayé — gravité faible | `useRoomSession` enregistrait les événements Socket.IO dans un effet à dépendances vides tout en capturant plusieurs fonctions recréées à chaque rendu. Le code courant s'appuyait surtout sur des refs, sans défaut utilisateur reproduit, mais cette fermeture ancienne rendait les évolutions fragiles. Deux canevas masquaient aussi leurs vraies dépendances derrière des refs. | Les souscriptions appellent maintenant les gestionnaires courants via une ref dédiée ; les effets de canevas capturent explicitement le dessin courant. `useExhaustiveDependencies` est réactivée en erreur et ne produit plus de diagnostic. |
| Amélioration facultative | `noImportantStyles` et `noDescendingSpecificity` relèvent encore des feuilles de style historiques. Les `!important` observés servent majoritairement à `prefers-reduced-motion`; leur suppression sans revue visuelle pourrait dégrader l'accessibilité. | Règles laissées désactivées dans ce lot ; traitement différé à une revue CSS ciblée. |
| Décision produit/infrastructure nécessaire | Le serveur borne les messages à 2,5 Mo, valide strictement les commandes et limite les salons à huit joueurs, mais n'applique pas de quota global par IP ou par compte. Un limiteur mémoire local serait incomplet sur plusieurs instances et peut pénaliser un groupe derrière la même adresse. | Aucun seuil arbitraire ajouté. Définir le modèle d'abus, les capacités Render/proxy et les seuils attendus avant implémentation. |
| Décision de conformité nécessaire | Les corrections ARIA et le lint ne valent ni choix d'un référentiel, ni audit clavier/lecteur d'écran/contraste complet, ni revue OWASP Top 10. | À traiter dans le lot d'audit prévu ; aucun statut de conformité n'est revendiqué. |

La revue du code et les contre-tests n'ont pas démontré de fuite de jeton, de niveau secret ou d'estimation avant la révélation. Les actions de l'hôte, du dessinateur et des votants restent contrôlées côté serveur selon la phase. Les répétitions et événements tardifs testés sont rejetés sans faire progresser une seconde fois l'état du jeu.

### Corrections retenues et résultats attendus

| Problème | Impact | Comportement attendu | Vérification |
| --- | --- | --- | --- |
| Origine WebSocket non contrôlée | Un site tiers ouvert dans le navigateur pouvait initier une connexion au service et consommer ses ressources ou piloter une session dont il aurait obtenu les identifiants. | Une origine étrangère est refusée ; le même hôte, une origine explicitement autorisée, un client non navigateur et le proxy Vite local restent utilisables. | Reproduction avant correction : origine étrangère acceptée. Après correction : étrangère refusée ; même origine, origine explicite et absence d'origine acceptées ; `localhost:5173` accepté uniquement avec l'option locale. |
| En-têtes de navigateur absents | Défense insuffisante autour des jetons stockés et possibilité d'intégrer l'interface dans une frame tierce. | Scripts limités à l'origine, framing interdit, type sniffing et permissions sensibles désactivés, référent non transmis. | Réponse de `/api/health` en production : les cinq en-têtes attendus sont présents et `X-Powered-By` est absent ; la recette Chromium n'émet aucune erreur CSP. |
| Attributs ARIA et regroupements non conformes aux règles réactivées | Noms accessibles potentiellement incohérents et garde-fous inactifs pour les futures modifications. | Les libellés restent perceptibles, les groupes utilisent `section`, `fieldset` et `legend`, les icônes décoratives sont masquées explicitement. | Les règles `noNoninteractiveTabindex`, `noSvgWithoutTitle`, `useAriaPropsSupportedByRole` et `useSemanticElements` ne signalent plus rien ; parcours complet réussi. |
| Effets React difficiles à vérifier | Risque futur de gestionnaire Socket.IO obsolète et de rendu de canevas non resynchronisé. | Les listeners stables délèguent toujours aux gestionnaires du dernier rendu ; un changement de dessin redéclenche explicitement le rendu. | `useExhaustiveDependencies` ne signale plus rien ; restauration après actualisation et six tours réussis sans erreur navigateur. |

### Contrôles exécutés sur le commit applicatif

Environnement : Windows/PowerShell, Node `22.12.0`, npm `10.9.0`, Playwright temporaire `1.56.1`, Chromium `141.0.7390.37`. Les scripts de contre-vérification ont été créés dans le répertoire temporaire Windows et ne sont pas conservés dans le dépôt.

| Contrôle | Résultat observé |
| --- | --- |
| Installation | `npm ci` : 133 paquets, 0 vulnérabilité. |
| Contrôles consolidés | `npm run check` : formatage de 86 fichiers, lint de 76 fichiers, typecheck des trois workspaces et build réussis. Le premier passage s'est arrêté sur une ligne vide ajoutée pendant l'édition CSS ; le formatage a été appliqué, puis le contrôle complet a réussi. Ce n'était pas un défaut applicatif. |
| Audit | `npm audit --audit-level=high` : 0 vulnérabilité. |
| Build client | Bundle principal : 329,79 kB, 98,15 kB gzip ; CSS : 81,92 kB, 15,76 kB gzip. |
| Production | `NODE_ENV=production`, port `3210`, serveur lancé avec Node `22.12.0` ; arrêt gracieux sur `SIGINT`. |
| Santé et en-têtes | `GET /api/health` : HTTP 200 et corps attendu ; CSP, Permissions Policy, Referrer Policy, `nosniff` et anti-framing observés ; aucune signature Express. |
| Autorisations et confidentialité | Refus vérifiés pour lancement non-hôte, lancement avant préparation, second lancement, dessin non-dessinateur, vote du dessinateur, tour périmé, second vote, continuation non-hôte et continuation répétée. Secret reçu par le seul dessinateur ; jeton, secret et valeur d'estimation absents de l'état public avant révélation. |
| Restauration et cycle de vie | Restauration par la même instance navigateur, déconnexion de la socket remplacée, départ de l'hôte, transfert d'hôte, expiration du délai, retrait du joueur et annulation de la partie active vérifiés. |
| Recette navigateur | Trois contextes Chromium indépendants, salon `HTCEW`, ordre Alice, Chloe, Bob, Alice, Chloe, Bob ; six tours/deux manches, dessin, confirmations, deux votes, révélations, scores, actualisation/restauration d'un votant, classement final, revanche et départ. Résultat réussi, 0 erreur de page ou de console. |

### Limites restantes

- Aucune nouvelle suite E2E ou unitaire permanente n'a été ajoutée, conformément à l'ordre des lots ; la couverture majoritaire de C2.2.2 reste à produire.
- Aucun audit OWASP Top 10 complet, référentiel d'accessibilité, lecteur d'écran, matrice clavier, mesure de contraste ou test d'agrandissement n'a été exécuté.
- Les quotas d'abus globaux, la saturation par connexions distribuées, la limite exacte à huit joueurs, le neuvième refusé et la charge maximale de 2,5 Mo n'ont pas été contre-testés dans ce lot.
- La recette post-correction a été exécutée localement sur le serveur de production construit. L'instance Render sert encore `develop` tant que la PR n'est pas fusionnée ; aucune configuration Render, branche protégée, `main` ou ancien dépôt n'a été modifié.

### Livraison GitHub

- PR : [#4](https://github.com/GagaYaba/draw-game/pull/4), branche `fix/application-hardening` vers `develop`, non brouillon et déclarée fusionnable avec l'état `clean`.
- Tête contrôlée : `bd4492f5915cadc430d948143edf4de69a939f08`, qui contient le commit applicatif contre-testé et la consolidation documentaire initiale.
- Exécution CI : [37773512720](https://github.com/GagaYaba/draw-game/actions/runs/37773512720), sept contrôles réussis le 8 octobre 2026 : `Formatting`, `Lint`, `Typecheck`, `Build`, `Dependency audit`, `Branch policy` et `Quality`.
- `origin/develop` reste sur `5807a1c9748dfa68efee84493af75b28f91d8c77` et `origin/main` sur `a02b14bf05b28dbcec169da419c937c43466b50f` ; la PR n'est pas fusionnée dans ce lot.
