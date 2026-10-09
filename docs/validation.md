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

## Lot de revue applicative et vérification — 8 octobre 2026

Branche `chore/bloc2-review-evidence`, créée depuis `fix/application-hardening` au commit `2899673` (PR [#4](https://github.com/GagaYaba/draw-game/pull/4), non fusionnée à la date de ce lot). Ce lot ne modifie aucun comportement applicatif : il vérifie le lot précédent et corrige une reproductibilité de l'environnement Windows.

### Point de départ constaté

- `develop` : `5807a1c9748dfa68efee84493af75b28f91d8c77` ; `main` : `a02b14bf05b28dbcec169da419c937c43466b50f` ; le lot de corrections existe localement et sur `origin/fix/application-hardening` au commit `2899673`.
- La grille `docs/context/Grille_evaluation_RNCP39583.xlsx`, onglet « Grille Eval Bloc 2 », a été lue en lecture seule : 9 compétences et 26 critères, dans l'ordre et avec la formulation de `docs/bloc2.md`. Aucun écart n'a été relevé.
- Versions d'exécution : Node `22.12.0` (version épinglée) ; npm `11.9.0` utilisé avec ce Node, au lieu de `10.9.0` épinglé. Un passage d'installation antérieur avait été fait avec Node `24.14.0`.

### Défaut reproduit — fins de ligne Windows

| Élément | Constat |
| --- | --- |
| Reproduction | Clone neuf sous Git for Windows (`core.autocrlf=true`) : 96 fichiers suivis reçus en CRLF ; `biome format` échoue (exit 1, 86 erreurs). |
| Cause | Le dépôt ne déclare aucune politique de fins de ligne ; l'index est en LF, Biome attend LF. |
| Gravité | Environnement de développement : aucun effet sur le code exécuté ni sur la CI Linux, mais le contrôle `Formatting` échoue pour tout clone Windows par défaut. |
| Correction | Ajout de `.gitattributes` avec `* text=auto eol=lf` (commit `784d11a`). |
| Contre-test | Clone neuf avec `core.autocrlf=true` sur la branche corrigée : fichiers reçus en LF (97 suivis en LF, binaires exclus) ; `biome format` réussit (86 fichiers, exit 0). |

### Contrôles exécutés

| Contrôle | Résultat observé |
| --- | --- |
| `npm run check` sous Node `22.12.0` | Réussi (exit 0) : formatage 86 fichiers, lint, typecheck des trois workspaces, build. Bundle principal 329,79 kB, 98,15 kB gzip ; CSS 81,92 kB, 15,76 kB gzip. |
| `npm ci` sous Node `24.14.0` (passage antérieur du lot) | Réussi, 0 vulnérabilité. |
| Relecture du code serveur (autorisations, phases, restauration, départ, expiration, origine WebSocket, validations de dessin et d'estimation) | Aucun défaut applicatif reproduit au-delà des constats du lot précédent. |
| Parcours socket réel sur le build de production, contre-vérification temporaire | **69 vérifications sur 69 réussies** (voir ci-dessous). |

Le script de contre-vérification est temporaire, hors dépôt, conformément à `AGENTS.md` ; il n'est pas une suite permanente. Il couvre, sur un serveur `NODE_ENV=production` construit :

- en-têtes HTTP de sécurité et absence de `X-Powered-By` ; origine étrangère refusée au handshake WebSocket, même hôte accepté ;
- création, jonction, doublon de pseudonyme insensible à la casse, code inconnu, socket déjà dans un salon ;
- prêt, refus du lancement par un non-hôte et avant que tous soient prêts ; un seul destinataire du secret de tour ;
- absence de `secretLevel` dans l'état public avant la révélation ;
- refus du dessin hors phase, par un non-dessinateur, au-delà de 250 traits, en second envoi ;
- refus de l'estimation du dessinateur, d'un tour périmé, d'une valeur hors 1–10, d'un doublon et d'une estimation tardive après révélation ;
- continuation refusée à un non-hôte ; parcours complet de six tours, classement final `FINISHED`, revanche refusée à un non-hôte puis acceptée pour l'hôte, retour au salon ;
- restauration avec un joueur inconnu refusée ; départs de deux joueurs du salon.

Non couverts par ce script : restauration avec le bon jeton après déconnexion réelle, expiration du délai de reconnexion, interface navigateur et limites maximales du canevas. Ces parcours restent dans les lots E2E et de recette.

### Constats retenus sans correction dans ce lot

| Constat | Catégorie | Décision |
| --- | --- | --- |
| `session:restore` quitte sans accusé de réception si le socket est déconnecté entre la validation et la restauration (`server/src/socket/register-socket-handlers.ts`). Le client attend alors le délai de 8 s puis réessaie. | Risque faible, non reproduit. | À traiter lors de la suite E2E de restauration ; aucune correction sans reproduction. |
| `startGame` compare le nombre de joueurs à la constante `3` au lieu de `MINIMUM_PLAYERS_TO_START` (`server/src/game/game-manager.ts`). | Amélioration facultative ; le comportement est identique. | Remplacer à la prochaine modification du fichier. |
| Aucun quota de salons, de connexions ou de messages par IP ou compte. | Décision produit et infrastructure, déjà consignée. | Inchangé. |

### Vérifications non exécutées

- Aucun passage sous npm `10.9.0` (non disponible dans cet environnement de travail).
- Aucune vérification du tableau de bord Render ni du commit servi : le constat précédent reste valable.
- Aucune ouverture de PR : l'outil GitHub CLI n'est pas installé dans cet environnement.

## Lot E2E des parcours principaux — 8 octobre 2026

Branche `test/e2e-main-paths`, créée depuis `develop` (`979255d`). Ce lot ajoute une suite E2E permanente, sans modifier le comportement applicatif.

### Outillage

- `@playwright/test` `1.56.1` (version exacte) en dépendance de développement ; navigateur Chromium `141.0.7390.37` (`chromium-1194`).
- `playwright.config.ts` : un worker, une partie par scénario, serveur lancé sur le build de production (`npm run build && npm start`, port `3480`).
- Commande : `npm run test:e2e`. Les fichiers `e2e/` sont inclus dans `format:check` et `lint`.
- Job CI `E2E` ajouté dans `.github/workflows/ci.yml` : il n'entre pas dans la synthèse `Quality`, car les protections de branche ne l'exigent pas encore.

### Scénarios

| Fichier | Parcours couvert | Vérifications principales |
| --- | --- | --- |
| `e2e/main-game.spec.ts` | Salon à trois joueurs, prêt, lancement, deux manches (six tours), restauration d'un votant après actualisation pendant son estimation, classement final, revanche, départ d'un joueur. | Chaque joueur voit les autres ; seul l'hôte lance ; le votant retrouve son formulaire après actualisation et peut voter ; les estimations sont révélées ; la revanche ramène les trois sessions au salon ; un départ retire le joueur du salon. Aucune erreur de page ni de console. |

### Résultat

Exécution sous Node `22.12.0` (npm `11.9.0` localement, `10.9.0` en CI) :

- `npm run check` : réussi (exit 0).
- `npm run test:e2e` : **1 test réussi**, 33,3 s pour le scénario.
- CI : PR [#6](https://github.com/GagaYaba/draw-game/pull/6), run [37781100957](https://github.com/GagaYaba/draw-game/actions/runs/37781100957) : job `E2E` réussi en 11 min 32 s, installation de Chromium comprise.
- Fusion dans `develop` : commit `5a696ff`, après huit contrôles verts.

### Limites

- Un seul scénario d'ensemble. Les refus d'autorisation, l'expiration du délai de reconnexion et les erreurs de saisie ne sont pas encore couverts par E2E ; ils restent à traiter.
- La restauration est testée par actualisation, pas par coupure réseau réelle.
- Un contrôle de non-régression (une mutation volontaire du comportement de restauration) n'a pas encore été exécuté.

### Accélération du job E2E

Le job E2E prenait 11 min 32 s, dont la majeure partie était l'installation de Chromium et de ses dépendances système (`playwright install --with-deps`). Le job tourne désormais dans l'image officielle `mcr.microsoft.com/playwright:v1.56.1-noble`, dont la version suit celle de `@playwright/test`.

- PR [#7](https://github.com/GagaYaba/draw-game/pull/7), run [37785154025](https://github.com/GagaYaba/draw-game/actions/runs/37785154025) : job `E2E` réussi en 1 min 21 s.
- Fusion dans `develop` : commit `08b82a1`, après huit contrôles verts.
- L'image doit être ré-épinglée à chaque montée de version de `@playwright/test`.

## Lot quotas, bornes de joueurs et tests unitaires — 8 octobre 2026

Branche `feat/abuse-limits-2-6-players`, depuis `develop` (`08b82a1`). Ce lot applique les décisions de `docs/securite.md`.

### Changement de règle

- Salons de **2 à 6 joueurs** (précédemment 3 à 8). Décision du porteur du projet, qui remplace la règle de la reprise initiale.
- Le serveur refuse le lancement sous 2 joueurs et le septième joueur d'un salon. L'accueil affiche « De 2 à 6 joueurs ».
- Avec deux joueurs, chaque tour compte un seul votant : la règle de score et l'ordre des tours sont inchangés.

### Quotas implémentés

| Quota | Emplacement | Contrôle |
| --- | --- | --- |
| 60 requêtes HTTP par minute et par IP | `server/src/create-server.ts` | Préalable à toutes les routes `/api`. |
| 5 événements Socket.IO par seconde et par connexion | `server/src/socket/register-socket-handlers.ts` | Middleware `socket.use`, accusé `RATE_LIMITED`. |
| 30 connexions simultanées par IP | `server/src/create-server.ts`, `server/src/security/socket-guard.ts` | Refus au handshake. |
| 5 salons par IP et par 24 h | `server/src/socket/register-socket-handlers.ts` | Accusé `RATE_LIMITED` à la création. |
| 5 échecs par connexion, 20 par IP, sur 15 min | `server/src/socket/register-socket-handlers.ts` | Jonction et restauration. |
| Fermeture des salons inactifs après 24 h | `server/src/rooms/room-manager.ts`, `server/src/create-server.ts` | Contrôle toutes les 10 minutes. |

Le code d'erreur `RATE_LIMITED` est ajouté à `RoomErrorCode` dans `shared/`.

### Résultats

| Contrôle | Commande ou méthode | Résultat |
| --- | --- | --- |
| Tests unitaires | `npm run test:unit` (Node 22.12.0) | **13 réussis, 0 échec** |
| Qualité | `npm run check` (Node 22.12.0) | Réussi (exit 0) |
| Partie complète | `npm run test:e2e` (Node 22.12.0) | **1 test réussi** (trois joueurs) |
| Quotas sur le build de production | Script temporaire, hors dépôt | **5 contrôles sur 5** : 60 requêtes HTTP acceptées puis 429 ; rafale de 12 événements avec refus `RATE_LIMITED` ; 31e connexion refusée depuis la même IP ; 6e création de salon refusée, les cinq premières acceptées. |

Un premier passage du script de contre-vérification comptait mal les requêtes du test lui-même et réutilisait une connexion déjà placée dans un salon : ces erreurs étaient dans le script, pas dans l'application.

### Limites

- Compteurs en mémoire, instance unique sur Render.
- Une adresse IP partagée (salle de classe) peut atteindre le quota de connexions ou de salons.
- Pas de mesure de la taille réelle maximale d'un dessin produit par un client.
- Les tests unitaires ne couvrent pas encore la majorité du code : C2.2.2 reste partiel.

## Constat Render après fusion de la PR #10 — 9 octobre 2026

- Tableau de bord Render : service `drawing-game`, dépôt `GagaYaba/draw-game`, branche `develop`, commit servi `cae3504` (fusion de la PR #10), statut *Live*.
- Réglages consultés : build `npm ci --include=dev && npm run build`, démarrage `npm start`, route de santé `/api/health`, *Auto-Deploy* sur *After CI Checks Pass*, *PR Previews* désactivé, pas de commande de pré-déploiement.
- Le déploiement de `cae3504` a le déclencheur **Manual** ; le même constat vaut pour les déploiements précédents.
- Le service est marqué **Blueprint managed**. Sa source (dépôt, fichier) n'est pas identifiée et le dépôt ne contient pas de `render.yaml`.

**Conclusion** : le commit servi est identifié et les réglages sont conformes au protocole. L'auto-déploiement après CI n'est **pas encore prouvé** : il faudra un merge dans `develop` sans déclenchement manuel, suivi d'un déploiement dont le déclencheur n'est pas *Manual*. Le critère C2.1.1 (séquence de déploiement) reste partiel.

## Blueprint Render — 9 octobre 2026

- Constat : le service `drawing-game` est géré par un Blueprint rattaché à l'ancien dépôt `GagaYaba/drawing-game` (branche `main`), alors que le service construit `GagaYaba/draw-game`. Aucun déploiement automatique n'a été observé après la fusion des PR #10 et #11 : tous les déploiements ont le déclencheur *Manual*.
- Décision du propriétaire : créer un Blueprint pour `draw-game`, puis supprimer celui de l'ancien dépôt.
- Fichier ajouté : `render.yaml`. Une première version écrite à la main a été remplacée par l'export généré par Render à partir du service existant : service nommé `game`, région `frankfurt`, plan Free, branche `develop`, build `npm ci --include=dev && npm run build`, démarrage `npm start`, route de santé `/api/health`, `autoDeployTrigger: checksPass`, variables `PLAYER_RECONNECT_GRACE_MS` et `NODE_ENV` sans valeur versionnée. L'export confirme la validité de ces champs pour Render.
- Non vérifié : la validité du fichier par Render, la reprise du service existant par le nouveau Blueprint (par opposition à la création d'un second service) et le déclenchement automatique. Ces points se contrôlent dans Render à la création du Blueprint, puis lors du prochain merge sans déploiement manuel.

## Lots du plan d'exécution BLOC 2 (étapes 0 à 11) — 9 octobre 2026

Ces lots suivent le plan de `docs/bloc2.md`. Chaque ligne renvoie à la PR fusionnée dans `develop` et à son commit de fusion ; les contrôles requis (`Formatting`, `Lint`, `Typecheck`, `Build`, `Dependency audit`, `Unit tests`, `E2E`, `Quality`, `Branch policy`) étaient tous verts à chaque fusion. La CI s'exécute sous Node 22.12.0 ; les essais locaux de ces lots ont tourné sous Node 24.14.0 (les résultats qui font foi sont ceux de la CI).

### Lots exécutés

| Étape | PR (commit de fusion) | Livrable | Résultat consigné |
| --- | --- | --- | --- |
| 0 | #14 (`1006a08`) | Plan consigné, `Unit tests` et `E2E` rendus obligatoires | Protections de branche appliquées sur `develop` et `main`. |
| 1 | #15 (`29b179f`) | Besoins, 27 user stories, cahier de recettes (`docs/recette.md`) | User stories à valider par le porteur. |
| 1 bis | #16 (`e3596f2`) | Dessin simultané, un dessin révélé à la fois, barème de 0 à 2 points | Règles serveur, écrans et E2E adaptés. |
| 2 | #17 (`490b38f`) | 30 tests unitaires et d'intégration regroupés par risque | Couverture mesurée, seuil de 70 % en CI. |
| 3 | #18 (`2f43ee7`) | 3 parcours E2E complémentaires | Lien d'invitation, partie à deux joueurs sur téléphone, coupure et expiration. |
| 4 | #19 (`c2948a3`) | Audit OWASP Top 10:2025 (`docs/securite.md`) | Cinq corrections, test de robustesse, journal de sécurité. |
| 5 | #20 (`fab4b4d`) | Audit RGAA 4.1 AA (`docs/accessibilite.md`) | 0 violation axe-core WCAG 2.1 A/AA sur tous les écrans à 320 px et sur ordinateur ; contrastes mesurés ; parcours clavier. |
| 6 | #21 (`7981a05`) | Budgets, mesures et test de charge (`docs/performance.md`) | Lighthouse mobile 78 ; 20 salons de 6 joueurs sans échec. |
| 7 | #22 (`7d44217`), #23 (`d3c0774`), #24 (`03f6fe9`) | Préproduction et production, `smoke-check.mjs`, promotion vers `main` | Contrôle réussi sur la préproduction (commit servi `7d44217`) ; production non contrôlée. |
| 8 | #25 (`3dec409`) | Protocole de validation par des utilisateurs (`docs/validation-utilisateurs.md`) | Aucune session à ce jour. |
| 9 | #26 (`aedb61f`) | Cahier de recettes exécuté (`docs/recette.md`, section 5 ter) | 37 scénarios sur 44 réussis, 5 partiels, 2 non exécutés. |
| 10 | #27 (`158f402`) | Manuels et décisions (`docs/deploiement.md`, `utilisation.md`, `mise-a-jour.md`, `decisions.md`) | Relecture extérieure non faite. |
| 11 | #28 (`4ba05f1`) | Bilan de la matrice (`docs/bloc2.md`) | 13 critères Disponible, 13 Partiel ; 15 et 11 après le report de ce registre (critères 22 et 23). |

CI de référence : exécution [37941591446](https://github.com/GagaYaba/draw-game/actions/runs/37941591446) sur `develop` (`158f402`), réussie ; exécution [37933377922](https://github.com/GagaYaba/draw-game/actions/runs/37933377922) sur `main` (`03f6fe9`), réussie.

### Résultats mesurés

| Mesure | Résultat | Source |
| --- | --- | --- |
| Tests unitaires et d'intégration | 31 réussis, 0 échec | `npm run test:unit` en CI |
| Tests E2E | 6 réussis (parcours à trois joueurs, trois parcours complémentaires, deux contrôles d'accessibilité) | `npm run test:e2e` en CI |
| Couverture des lignes | 75,0 % (9 537 sur 12 719) : serveur 85,4 %, composants React 80,0 %, partagé 100 %, client hors composants 44,0 % | `npm run test:coverage` |
| Accessibilité | 0 violation axe-core, contrastes conformes, aucun défilement horizontal à 320 px | `docs/accessibilite.md` |
| Performance | Lighthouse mobile : performance 78, accessibilité 100, bonnes pratiques 100, LCP 2,6 s, CLS 0, TBT 740 ms | `docs/performance.md` |
| Charge | 20 salons de 6 joueurs : 0 échec, accusé p95 de 205 à 262 ms ; 60 salons : p95 de 499 ms | `npm run perf:load` |
| Mémoire du serveur | 62 Mo au repos, 186 Mo après 360 connexions cumulées | relevé local |
| Cahier de recettes | 37 réussis, 5 partiels, 2 non exécutés sur 44 | `docs/recette.md` |
| Premier chargement Render | 23 s après mise en veille ; 0,16 s ensuite | requêtes sur le service en ligne |

### Registre des anomalies et échecs qualifiés

| # | Constat | Catégorie | Gravité | Cause | Correction | Vérification | PR |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `Unit tests` en échec en CI : module partagé introuvable | Défaut de CI | Modérée | Le script `test:unit` supposait `shared/dist` déjà construit, absent d'un clone neuf | `test:unit` construit `shared` d'abord | CI verte | #17 |
| 2 | Le parcours E2E sur téléphone restait bloqué à la deuxième manche | Défaut reproduit | Modérée | La page restait défilée en bas après un changement d'écran : la zone de dessin était hors de vue | Retour en haut de page à chaque changement d'écran (`client/src/App.tsx`) | E2E téléphone | #18 |
| 3 | La sixième salle créée par la suite E2E était refusée | Décision | Faible | Quota de 5 salons par adresse et par jour, appliqué à une suite qui en crée davantage depuis une seule adresse | Variable `MAX_ROOMS_PER_IP_PER_DAY` ; valeur de production inchangée (5) | E2E (relevée à 1000) | #20 |
| 4 | Le bloc du joueur courant débordait de son cadre dans le classement à 320 px | Défaut reproduit | Faible | Marge intérieure insuffisante, révélée par la mesure de contraste | Correction de la feuille de style du podium | E2E d'accessibilité à 320 px | #20 |
| 5 | Aucun titre de niveau 1 sur les écrans de partie | Amélioration (RGAA 9.1) | Faible | Seul l'accueil en portait un | Titre masqué visuellement ajouté | axe-core | #20 |
| 6 | Violation de contraste sur le bouton de validation, uniquement en CI | Faux positif du test | Faible | Mesure pendant la transition de couleur qui suit l'activation du bouton, sur un exécuteur plus lent | Attente de la fin des transitions avant la mesure | E2E d'accessibilité en CI | #20 |
| 7 | Le test d'accessibilité dépassait 120 s en CI | Défaut de test | Faible | Attente des transitions sans limite de durée | Attente bornée à 2 s, limite du test portée à 300 s | E2E d'accessibilité en CI | #20 |
| 8 | Alerte `npm audit` sur le paquet `compression` ajouté | Risque évité | Haute | Version 1.8.1 vulnérable à un déni de service | Dépendance retirée : Render compresse déjà en Brotli | `Dependency audit` à 0 vulnérabilité | #21 |
| 9 | Service `game-prod` en échec au premier déploiement | Attendu | Sans objet | `main` ne contenait que le commit d'amorçage | Promotion `develop` vers `main` | Déploiement réussi | #24 |
| 10 | `render.yaml` nommait `game` un service nommé `game-preprod` dans Render | Écart de configuration | Faible | Service renommé dans le tableau de bord | Fichier aligné sur les noms réels | Relecture du tableau de bord | #23 |
| 11 | Test de reconnexion instable (environ 1 échec sur 9 en local, 1 en CI) | Test instable | Modérée pour la CI | Page fermée pendant la phase d'interrogation HTTP de Socket.IO : le serveur ne détecte la coupure qu'au bout du délai de battement de cœur (jusqu'à 45 s) | Attente de la montée en WebSocket avant chaque coupure (`watchSocketUpgrade`) | 18 exécutions consécutives réussies, puis CI verte | #26 |

Les cinq corrections issues de l'audit OWASP (étape 4) et leurs contre-tests sont décrites dans `docs/securite.md`.

### Points non corrigés, par décision

| Constat | Qualification | Décision |
| --- | --- | --- |
| Après un redémarrage du serveur, la partie est perdue ; l'écran de coupure annonce pourtant « Votre place est conservée » | Écart constaté pendant la recette (RC27) | L'état est en mémoire sur une instance unique : accepté pour l'instant, à rediscuter selon les retours des testeurs. |
| Temps de blocage total de 740 ms au chargement sur le profil mobile simulé | Amélioration | Non traité ; pistes : découpage du JavaScript, images en WebP. |
| Premier chargement de 23 s après mise en veille | Décision d'infrastructure | Plan payant, appel périodique ou acceptation : décision du porteur du projet. |
| Le dessin à main levée n'est pas utilisable au clavier | Non-conformité déclarée (RGAA) | Documentée dans `docs/accessibilite.md`. |

### Vérifications non exécutées

- Déclenchement automatique du déploiement observé sans clic manuel (les déploiements consultés portaient le déclencheur manuel) et retour arrière sur Render.
- Contrôle `smoke-check.mjs` sur le service de production (URL non communiquée).
- Sessions de validation par des utilisateurs, lecteur d'écran, texte à 200 %, appareils tactiles réels.
- Relecture extérieure des manuels et installation sur un poste vierge.
