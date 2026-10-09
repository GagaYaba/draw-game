# Sécurité : modèle de menace et quotas

Ce document fixe les menaces retenues, les contrôles en place et les valeurs de quotas. Il répond au critère C2.2.1 (sécurité) et sert de base à l'audit OWASP (C2.2.3).

## Périmètre

- Serveur Express et Socket.IO hébergé sur Render (instance unique, plan Free, en mémoire).
- Pas de compte utilisateur, pas de messagerie, pas de base de données. L'identité d'un joueur est un jeton de session (256 bits, stocké haché côté serveur) et un identifiant d'instance cliente.

## Biens à protéger

- Disponibilité du serveur (mémoire, CPU, nombre de connexions).
- Intégrité des parties : secrets de tour, estimations non révélées, scores.
- Sessions : un jeton volé ou deviné permet de reprendre une place.

## Menaces retenues

| Menace | Contrôle | Limite résiduelle |
| --- | --- | --- |
| Flood HTTP sur `/api` | 60 requêtes par minute et par adresse IP, réponse HTTP 429 et en-tête `Retry-After`. | Les fichiers statiques ne sont pas limités. |
| Flood Socket.IO | 5 événements par seconde et par connexion (rafale de 5). Au-delà, accusé `RATE_LIMITED` ou événement ignoré. | Pas de limite par compte : il n'existe pas de compte. |
| Saturation par connexions | 30 connexions simultanées par adresse IP, dimensionné pour une salle de classe. | Une adresse partagée peut atteindre la limite avec 30 élèves. |
| Création massive de salons | 5 salons par adresse IP sur 24 heures. | Même limite par adresse partagée. |
| Salons abandonnés | Fermeture d'un salon sans action pendant 24 heures (contrôle toutes les 10 minutes). | Les salons restent en mémoire jusqu'à ce contrôle. |
| Énumération de codes de salon | 5 échecs par connexion et 20 échecs par adresse IP sur 15 minutes. | Un code de 5 caractères compte environ 33 millions de combinaisons ; les quotas réduisent l'énumération sans l'éliminer. |
| Force brute sur les jetons de reprise | Mêmes quotas d'échecs. Un jeton de 256 bits n'est pas devinable. | Un jeton volé reste valable pendant la fenêtre de reconnexion. |
| Messages trop volumineux | Limite de 2,5 Mo par message (Socket.IO) et limites du document de dessin (250 traits, 30 000 points). | Aucune mesure réelle de la taille maximale produite par un client. |
| Ajout de joueurs au-delà des règles | 2 joueurs minimum, 6 maximum. | Décision du porteur du projet, qui remplace la règle précédente de 3 à 8 joueurs. |

## Valeurs retenues

| Paramètre | Valeur | Origine du choix |
| --- | --- | --- |
| Requêtes HTTP `/api` | 60/min par IP | Demande du porteur du projet. |
| Événements Socket.IO | 5/s par connexion | Demande du porteur du projet ; une partie consomme quelques événements par tour. |
| Connexions simultanées | 30 par IP | Choix : une salle de classe partage une adresse publique. |
| Salons créés | 5 par IP et par 24 h | Demande du porteur du projet, appliquée à l'adresse IP faute de comptes. |
| Échecs d'accès | 5 par connexion, 20 par IP, sur 15 min | Choix : le seuil par IP est plus haut pour ne pas bloquer une classe. |
| Salons inactifs | 24 h sans action | Demande du porteur du projet ; une action est tout événement d'un joueur du salon. |
| Joueurs | 2 à 6 | Demande du porteur du projet. |

## Proxy et adresse IP

Render place le serveur derrière un proxy. Le serveur retient la **dernière** adresse de `X-Forwarded-For`, celle ajoutée par le proxy ; les valeurs envoyées par le client avant elle sont ignorées. Sans cette lecture, toutes les requêtes auraient la même adresse, et les quotas par IP bloqueraient tout le monde ou personne.

## Limites de l'implémentation

- Les compteurs sont en mémoire : ils sont remis à zéro à chaque redémarrage et ne sont pas partagés entre instances. Une seconde instance imposerait un stockage partagé.
- Les vérifications de santé Render interrogent `/api/health`, donc comptent dans la limite HTTP. Le seuil reste largement supérieur à leur fréquence.
- Les quotas ne remplacent pas un audit OWASP complet (C2.2.3).

## Preuves

- Tests unitaires : `server/test/security.test.ts` (débit, fenêtres, adresse IP, quotas d'accès et de connexions) et `server/test/rooms.test.ts` (bornes de joueurs, fermeture des salons inactifs). Exécution : `npm run test:unit`.
- Contre-vérification sur le build de production : 60 requêtes HTTP acceptées puis 429 ; rafale de 12 événements avec refus `RATE_LIMITED` ; 31e connexion refusée depuis la même IP ; 6e création de salon refusée. Le script est temporaire et hors dépôt.

## Audit OWASP Top 10:2025

Édition retenue : **OWASP Top 10:2025** (publiée en novembre 2025), version courante à la date de l'audit, le 9 octobre 2026. Chaque catégorie est analysée contre le code du dépôt ; la preuve est un test, une commande ou un fichier consultable. L'audit est une auto-évaluation : aucun test d'intrusion externe n'a été réalisé.

| Catégorie | Mesures en place | Preuve | Limite et décision |
| --- | --- | --- | --- |
| **A01 Contrôle d'accès défaillant** | Le serveur décide des rôles (hôte, auteur, votant), des phases et des secrets. Les événements privés (`turn:secret`) vont à une seule connexion. Une connexion n'agit que dans son salon. | `server/test/server.test.ts` : refus par rôle et par phase ; `server/test/game.test.ts` : aucun niveau secret dans l'état public | Aucune authentification forte : l'accès repose sur un code de salon et un jeton de session. |
| **A02 Mauvaise configuration de sécurité** | CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` ; `X-Powered-By` retiré ; **HSTS ajouté** pour les requêtes reçues en HTTPS derrière Render ; origine WebSocket contrôlée ; configuration Render décrite dans `render.yaml`. | `server/test/quotas.test.ts` (en-têtes, HSTS, origines) | La CSP garde `'unsafe-inline'` pour les styles et `ws:`/`wss:` pour la connexion, afin de ne pas casser certains navigateurs. |
| **A03 Défaillances de la chaîne d'approvisionnement** | Dépendances verrouillées (`package-lock.json`), Node et npm épinglés, `npm ci`, `npm audit` en CI (0 vulnérabilité haute), actions GitHub épinglées par empreinte (celle d'`upload-artifact` vérifiée contre la balise `v4.6.2`). | Job CI `Dependency audit`, `.github/workflows/ci.yml` | L'image Playwright de la CI est épinglée par version, pas par empreinte ; pas de mise à jour automatique des dépendances (Dependabot est incompatible avec la politique de branches). |
| **A04 Défaillances cryptographiques** | Jetons de session de 256 bits tirés par `crypto.randomBytes`, stockés hachés (SHA-256) et comparés en temps constant ; codes de salon par `crypto.randomInt`. **Les niveaux secrets, l'ordre des dessins et les consignes utilisent désormais une source cryptographique** (auparavant `Math.random`, prévisible à partir des valeurs révélées). TLS assuré par Render. | `server/src/sessions/session-token.ts`, `server/src/game/game-random.ts`, `server/test/validation.test.ts` | Le jeton est conservé dans le stockage local du navigateur : un XSS le révélerait, d'où la CSP stricte sur les scripts. |
| **A05 Injection** | Aucune base de données ni commande système ; aucun `innerHTML`, `eval` ni `dangerouslySetInnerHTML` dans le code. Toutes les charges Socket.IO sont validées strictement (clés exactes, types, bornes, prototypes). React échappe le texte affiché. | Recherche des puits d'injection (aucun résultat) ; `server/test/validation.test.ts` ; `server/test/server.test.ts` (charges inattendues) | Les pseudonymes sont limités aux lettres, chiffres, espaces, tirets et soulignés. |
| **A06 Conception non sécurisée** | Modèle de menace et quotas (section précédente) ; règles du jeu appliquées côté serveur ; salons inactifs fermés. | `docs/securite.md`, `server/test/quotas.test.ts`, `server/test/rooms.test.ts` | Compteurs en mémoire, instance unique. |
| **A07 Défaillances d'authentification** | Session liée à un jeton secret et à un identifiant d'instance ; une session active ne peut pas être reprise depuis un autre onglet ; délai de reconnexion de 60 secondes ; échecs d'accès limités (5 par connexion, 20 par adresse sur 15 minutes). | `server/test/server.test.ts` (restauration, expiration, session déjà active), `server/test/quotas.test.ts` | Pas de comptes ; un jeton volé reste valable tant que le joueur est dans le salon. |
| **A08 Défaillances d'intégrité des logiciels et des données** | Branches protégées, PR obligatoires, neuf contrôles requis, actions épinglées par empreinte, entrées désérialisées uniquement après validation stricte. | Protections de `develop` et `main`, `.github/workflows/ci.yml` | Commits non signés ; l'image Docker de la CI n'est pas épinglée par empreinte. |
| **A09 Défaillances de journalisation et d'alerte** | **Journal d'événements de sécurité ajouté** : une ligne JSON par événement (origine refusée, limite de connexions, flood HTTP ou d'événements, création de salons limitée, échec et blocage d'accès) avec adresse IP masquée, lisible dans les journaux de Render. Les erreurs internes inattendues sont journalisées côté serveur et masquées côté client. | `server/src/security/security-log.ts`, `server/test/quotas.test.ts` (événements émis) | Pas d'alerte automatique au-delà des notifications d'échec de déploiement de Render ; les journaux sont consultés à la main. |
| **A10 Mauvaise gestion des conditions exceptionnelles** | Les erreurs internes renvoient un message générique ; les commandes mal formées sont refusées sans modifier l'état ; arrêt gracieux à la réception d'un signal ; retour automatique de Render en cas de plantage. **Test de robustesse ajouté** : chaque événement reçoit des charges inattendues, puis le serveur est vérifié en état de marche. | `server/test/server.test.ts` (charges inattendues), `server/test/shutdown.test.ts` | Un plantage du processus efface les salons en mémoire ; aucun gestionnaire global d'exceptions n'est ajouté pour ne pas masquer une corruption d'état. |

### Corrections apportées par cet audit

- **A02** : en-tête `Strict-Transport-Security` pour les requêtes reçues en HTTPS.
- **A04** : source aléatoire cryptographique pour les niveaux secrets, l'ordre des dessins et le choix des consignes.
- **A09** : journal d'événements de sécurité structuré, avec adresse IP masquée (donnée personnelle).
- **A10** : test de robustesse sur chaque événement Socket.IO.
- **A03** : empreinte de l'action `upload-artifact` vérifiée (conforme).

### Risques résiduels acceptés

- Pas de test d'intrusion externe ni d'analyse dynamique automatique (par exemple OWASP ZAP).
- Alerte manuelle seulement (A09) et instance unique en mémoire (A06, A10).
