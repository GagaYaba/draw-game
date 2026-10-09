# Accessibilité : référentiel, audit et déclaration

Ce document présente et justifie le référentiel d'accessibilité retenu (critère 15 de `docs/bloc2.md`), décrit l'audit réalisé et ses résultats (critères 11 et 16), et sert de base à la déclaration d'accessibilité. Date de l'audit : 9 octobre 2026.

## 1. Référentiel retenu

**RGAA 4.1, niveau AA**, qui s'appuie sur les critères de succès de niveau A et AA de **WCAG 2.1**.

Justification :
- Le RGAA est le référentiel d'accessibilité numérique français, cité en exemple dans la grille d'évaluation du titre. Le projet est évalué en France.
- La version 4.1 est la version en vigueur à la date de l'audit ; une version 5, alignée sur WCAG 2.2, est annoncée pour fin 2026. Sources consultées : [sk-web](https://sk-web.fr/article/rgaa-obligations-2026), [a11ywithdiana](https://a11ywithdiana.substack.com/p/rgaa-5-is-coming-what-does-it-mean) et [Adevweb](https://www.adevweb.com/ressources/audit-rgaa) ; la version officielle est à vérifier sur Légifrance avant toute déclaration publique.
- WCAG 2.1 AA est la base technique du RGAA 4.1 : les outils automatiques d'audit (axe-core) en appliquent directement les règles.
- OPQUAST est un recueil de bonnes pratiques et non un référentiel de conformité : il n'est pas retenu comme référentiel principal.

Le jeu est un service privé, sans obligation légale d'accessibilité. Le référentiel est appliqué volontairement, comme cadre de qualité.

## 2. Périmètre

Tous les écrans du parcours de jeu, sur ordinateur et sur écran de 320 pixels de large :

| Écran | Contrôlé |
| --- | --- |
| Accueil (création et jonction) | Oui |
| Salon (liste des joueurs, état prêt, lancement) | Oui |
| Introduction de manche | Rendu seulement (écran de 3 secondes) |
| Dessin (éditeur) et confirmation de validation | Oui |
| Attente des autres joueurs | Oui |
| Vote (votant et auteur) | Oui |
| Révélation | Oui |
| Classement final | Oui |
| Bandeau de reconnexion | Rendu seulement |

Le panneau « Diagnostic technique » est replié et masqué pendant la partie ; il est hors périmètre.

## 3. Méthode et contrôles exécutés

| Contrôle | Outil | Portée |
| --- | --- | --- |
| Règles WCAG 2.1 A et AA, plus bonnes pratiques d'axe-core | `@axe-core/playwright` 4.13.0, `e2e/accessibility.spec.ts` | Chaque écran, joueur à 320 px et joueur sur ordinateur |
| Contraste réellement affiché | `e2e/contrast.ts` | Chaque texte visible de chaque écran |
| Réflexion du contenu à 320 px (aucun défilement horizontal) | `e2e/accessibility.spec.ts` | Chaque écran du joueur à 320 px |
| Parcours au clavier avec focus visible | `e2e/accessibility.spec.ts` | Accueil, création de salon, état prêt |
| Règles Biome d'accessibilité en erreur | `biome.json`, CI `Lint` | Tout le code client |

**Pourquoi un contrôle de contraste maison.** axe-core ne peut pas décider du contraste sur les fonds en dégradé, les images, les pseudo-éléments et les ombres de texte : il renvoie des résultats « incomplets » (5 à 18 éléments par écran). Le contrôle de `e2e/contrast.ts` masque le texte, capture la fenêtre, puis mesure le rapport entre la couleur du texte et les pixels du fond sous les lettres (bande centrale de la ligne, 5 % des pixels les plus défavorables écartés). Seuils : 4,5:1, ou 3:1 pour un grand texte. Les ombres de texte ne sont pas prises en compte. Sa détection a été vérifiée par une mutation : un libellé volontairement trop clair (1,89:1) est bien signalé, alors que le même écran inchangé ne produit aucune alerte.

Exemptions appliquées : le logotype « Drawing Scale Game » (WCAG 1.4.3 et RGAA 3.2), les composants désactivés, les éléments masqués et les éléments derrière une boîte de dialogue modale.

**Non exécuté** (voir la section 7) : lecteur d'écran, agrandissement du texte à 200 % dans le navigateur, appareil tactile réel, vérification de la réduction des animations.

## 4. Résultats par thème du RGAA 4.1

| Thème | Applicable | Constat | Conclusion |
| --- | --- | --- | --- |
| 1. Images | Oui | Mascottes décoratives avec texte alternatif vide et masquées aux aides techniques ; dessins présentés avec une alternative textuelle courte (auteur et consigne) ; canevas d'édition avec un nom accessible. Le contenu du dessin lui-même n'a pas d'équivalent textuel. | Partiel |
| 2. Cadres | Non | Aucun cadre. | Sans objet |
| 3. Couleurs | Oui | Contrastes mesurés conformes sur tous les écrans. Le niveau 1 à 10 est donné par un chiffre, jamais par la couleur seule ; l'état prêt par un texte et un symbole. | Conforme (auto-évalué) |
| 4. Multimédia | Non | Ni son ni vidéo. | Sans objet |
| 5. Tableaux | Non | Aucun tableau. | Sans objet |
| 6. Liens | Peu | Aucun lien de contenu dans le parcours de jeu. | Sans objet |
| 7. Scripts | Oui | Messages d'état annoncés (`role="status"`, `role="alert"`) ; boîtes de dialogue avec gestion du clavier. **Le dessin à main levée n'est pas utilisable au clavier.** | Non conforme (canevas) |
| 8. Éléments obligatoires | Oui | Langue de la page, titre de page, jeu de caractères. Le titre de page reste identique sur tous les écrans de cette application à page unique. | Partiel |
| 9. Structuration | Oui | Titre de niveau 1 présent sur tous les écrans (ajouté par cet audit pour les écrans de partie), hiérarchie des titres, repère principal, listes. | Conforme (auto-évalué) |
| 10. Présentation | Oui | Aucun défilement horizontal à 320 px ; focus visible sur les contrôles testés ; zoom du navigateur non bloqué. Texte agrandi à 200 % non vérifié. | Partiel |
| 11. Formulaires | Oui | Champs avec étiquettes, erreurs annoncées. Le pseudonyme et le code de salon sont les seuls champs. | Conforme (auto-évalué) |
| 12. Navigation | Oui | Ordre de tabulation logique sur les écrans testés ; application à page unique sans menu ni plan du site. | Conforme (auto-évalué) |
| 13. Consultation | Oui | Aucune limite de temps sur les actions du joueur. Les mascottes ont des animations répétées sans bouton d'arrêt ; une règle `prefers-reduced-motion` existe mais n'est pas vérifiée. | Partiel |

« Auto-évalué » signifie que la conclusion repose sur les contrôles de la section 3 et sur la lecture du code, sans audit externe ni test avec des utilisateurs en situation de handicap.

## 5. Corrections apportées par l'audit

- **Classement final à 320 px** : le bloc du joueur courant (pseudonyme, étiquette « Vous », score) débordait de son cadre. Le contrôle de contraste l'a révélé ; la marge intérieure du bloc a été corrigée dans `client/src/components/FinishedScreen.css`.
- **Titre de niveau 1 manquant** sur les écrans de partie (bonne pratique, RGAA 9.1) : un titre masqué visuellement est ajouté dans `client/src/App.tsx`.

Les règles WCAG 2.1 A et AA d'axe-core ne signalaient aucune violation avant correction : la revue de l'accessibilité du lot de corrections applicatives (règles Biome en erreur) avait déjà traité les attributs ARIA et la sémantique.

## 6. Limites et dérogations

- **Dessin au clavier** : le canevas de dessin est un contrôle de pointage libre. Aucune alternative clavier (par exemple tracer avec les flèches) n'est fournie. Cette limite est inhérente au principe du jeu, qui repose sur un dessin visuel ; elle exclut les personnes qui ne peuvent pas utiliser un dispositif de pointage de dessiner. Elles peuvent rejoindre un salon, voter et lire les résultats.
- **Contenu visuel des dessins** : un dessin n'a pas d'équivalent textuel. Les personnes aveugles ne peuvent pas voter utilement sur un dessin. Aucune alternative n'est prévue dans ce lot.
- **Animations** : les mascottes s'animent en continu, sans bouton de pause.

Ces limites sont des non-conformités déclarées, pas des conformités.

## 7. Contrôles restant à réaliser

Ils demandent des gestes que l'audit automatisé ne remplace pas :

1. Parcours complet avec un lecteur d'écran (par exemple NVDA sous Windows) : noms, rôles, annonces des changements de phase.
2. Agrandissement du texte à 200 % dans le navigateur et lecture avec des réglages de contraste forcé.
3. Essai sur un téléphone et une tablette réels (dessin au doigt, saisie).
4. Vérification de la réduction des animations (`prefers-reduced-motion`) dans les réglages du système.

## 8. Déclaration d'accessibilité (projet)

Drawing Scale Game est **partiellement conforme** au RGAA 4.1, niveau AA, d'après une auto-évaluation réalisée le 9 octobre 2026 avec les contrôles de la section 3.

Contenus non accessibles : le dessin à main levée et le contenu visuel des dessins (section 6), les animations des mascottes sans arrêt possible.

Contenus non évalués : lecteur d'écran, texte agrandi à 200 %, appareils tactiles réels (section 7).

Contact et voies de recours : **à renseigner par le porteur du projet** avant toute publication de cette déclaration.
