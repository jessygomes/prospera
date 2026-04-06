# IA Conseils Client - Implementation et mode d'emploi

Ce document explique:

- comment la fonctionnalite IA est implementee dans Prospera,
- quelles donnees sont utilisees,
- comment fonctionne l'auto-analyse,
- comment bien utiliser le module au quotidien,
- comment depanner.

## 1) Objectif produit

Le module IA sert a guider le prochain contact commercial (appel, email, relance) avec:

- un diagnostic de la situation du client,
- un plan d'action concret,
- un angle de persuasion,
- une reponse aux objections,
- un timing recommande.

## 2) Pourquoi l'auto-analyse est cruciale

Sans auto-analyse:

- le CRM stocke du texte libre,
- l'IA doit re-analyser et deviner a chaque fois,
- la qualite des conseils varie.

Avec auto-analyse:

- le texte est converti en data exploitable,
- le contexte est structure avant la generation,
- les conseils sont plus precis,
- on debloque des features premium (score lead, dashboard blocages, suggestions auto).

Exemple:

- texte saisi: "Le client hesite, trouve ca cher, veut reflechir"
- extraction auto:
- `interactionOutcome = NEEDS_TIME`
- `interactionSentiment = NEUTRAL`
- `interactionObjections = ["prix"]`

## 2bis) A quoi sert exactement l'analyse structuree

L'analyse structuree transforme du texte libre en signaux commerciaux standards pour l'IA et le pilotage CRM.

Concretement, elle sert a:

1. Normaliser les comptes-rendus
1. Un texte comme "rappeler la semaine prochaine, il hesite sur le prix" est converti en champs comparables: outcome, sentiment, objections.
1. Ameliorer la pertinence des conseils IA
1. Le modele recoit des indicateurs explicites (maturite, blocages, tonalite), pas seulement un paragraphe ambigu.
1. Garder une coherence dans le temps
1. Meme si chaque commercial ecrit differemment, les donnees restent comparables entre actions et entre clients.
1. Permettre des stats actionnables
1. On peut mesurer facilement le volume d'interactions sans reponse, les objections frequentes, les signaux negatifs, etc.
1. Rendre l'interface plus lisible
1. Le badge "Analyse structuree active" indique qu'une action contient deja des signaux qualifies exploites par l'IA.

## 3) Vue d'ensemble de l'architecture

Composants principaux:

- generation LLM et fallback: `lib/ai/generate-client-next-advice.ts`
- auto-analyse interaction: `lib/ai/analyze-interaction.ts`
- moteur heuristique local: `lib/ai/client-advice.ts`
- actions serveur: `app/workspace/[workspaceId]/clients/actions.ts`
- UI conseils: `app/workspace/[workspaceId]/clients/[clientId]/client-ai-advice-panel.tsx`
- page client: `app/workspace/[workspaceId]/clients/[clientId]/page.tsx`
- schema: `prisma/schema.prisma`

## 4) Flux auto-analyse interaction

1. L'utilisateur saisit un resume interaction.
1. A la creation/mise a jour, l'app declenche `analyzeInteraction(text)` si outcome/sentiment/objections ne sont pas fournis.
1. L'extraction remplit automatiquement `interactionOutcome`, `interactionSentiment` et `interactionObjections`.
1. Les valeurs saisies manuellement restent prioritaires (pas d'ecrasement).
1. Les donnees structurees sont stockees dans `ClientAction`.

## 5) Flux generation conseils

1. L'utilisateur clique `Generer un conseil IA`.
1. L'action serveur charge client + interactions.
1. `generateClientNextAdvice` construit le prompt (incluant `quickStats`).
1. Provider choisi: OpenAI, sinon Anthropic, sinon fallback heuristique.
1. Reponse JSON parsee, historisee dans `AiGeneration`, puis cache `Client.aiInsights` mis a jour.
1. Le panneau front est rafraichi.

## 6) Donnees prises en compte

Contexte client envoye:

- `fullName`
- `status`
- `priority`
- `budgetEstimated`
- `company`
- `jobTitle`
- `notes`
- `aiInsights`

Historique interactions (recentes) envoye:

- `title`
- `type`
- `status`
- `actionGoal` (`description`)
- `interactionSummary` (resultat de l'echange)
- `outcome`
- `sentiment`
- `objections`
- `createdAt`
- `recencyWeight`

Statistiques agregees envoye:

- `totalInteractions`
- `withResponse`
- `interestedCount`
- `negativeCount`

## 7) Prompt et sortie attendue

Le prompt est dynamique et impose une sortie JSON stricte.

Cles de sortie attendues:

- `overallReading`
- `nextActionFocus`
- `objectionResponse`
- `persuasionAngle`
- `bestTiming`
- `score`
- `temperature`
- `mainObjections`
- `recommendedStrategy`
- `nextBestAction`
- `evidenceInteractionIndexes`

Garde-fou anti-hallucination:

- la sortie doit citer des index d'interactions sources (`evidenceInteractionIndexes`),
- si aucune source valide n'est fournie, la generation est rejetee et le systeme bascule en fallback heuristique.

Affichage front de ces preuves:

- les index restent internes (metadata + validation),
- l'interface affiche uniquement les titres des interactions source pour rester lisible.

## 7bis) Score de confiance conseil

Chaque conseil expose un score de confiance derive de la qualite du contexte.

Signaux principaux utilises:

- volume d'interactions disponibles,
- part d'interactions avec resultat explicite,
- part de signaux structures (outcome/sentiment/objections),
- richesse du contexte client (notes, budget, societe/role, insights precedents).

Sortie UI:

- score numerique (0-100),
- niveau (`LOW`, `MEDIUM`, `HIGH`),
- liste des signaux manquants pour expliquer pourquoi la confiance baisse.

Note implementation:

- le score de confiance est calcule cote serveur,
- il est persiste dans `AiGeneration.metadata.confidence`,
- en absence de metadata exploitable, un fallback de confiance est reconstruit depuis le contexte client/action courant.

## 7ter) Creation d'action recommandee en 1 clic

Depuis le panneau IA, le bouton `Creer l'action recommandee` cree automatiquement une action commerciale:

- type `FOLLOW_UP`, statut `TODO`,
- titre derive de la recommandation IA,
- description enrichie (objectif, timing, angle, reponse objection),
- lien de sequence via `previousActionId` vers la derniere action,
- echeance par defaut a J+2 09:00.

Source:

- l'action est tracee avec l'ID de la generation IA d'origine (auditabilite).

Comportement UX:

- le bouton est visible quand un conseil IA historise est present,
- l'action creee est pre-remplie mais editable ensuite dans la section actions.

## 8) Historisation et observabilite

Chaque generation est sauvegardee dans `AiGeneration`:

- `type = NEXT_ACTION_ADVICE`
- `prompt`
- `result`
- `provider`
- `model`
- `version`
- `inputTokens`, `outputTokens`, `totalTokens`, `costUsd`
- `feedbackScore`, `feedbackNote`, `feedbackAt`
- `metadata` (dont `quickStats`, `promptVersion`, `fallbackReason`)
- `metadata.confidence` (score, niveau, raisons, signaux manquants)
- `metadata.grounding` (grounded, index sources internes, nombre de preuves, fenetre interactions)

## 9) Comment bien l'utiliser (playbook equipe)

1. A chaque appel/email/relance, remplir au minimum le resume interaction.
1. Verifier outcome/sentiment/objections auto-remplis et corriger si necessaire.
1. Marquer l'action en `DONE` des qu'elle est terminee.
1. Maintenir les infos client a jour (budget, statut, notes, company/jobTitle).
1. Generer un conseil IA apres une interaction importante.
1. Donner un feedback (`Pertinent`/`Peu utile`) pour monitorer la qualite.

## 10) Limites actuelles

- la qualite depend de la qualite du resume saisi,
- l'auto-analyse peut etre imparfaite si le texte est vague,
- le prompt utilise une fenetre recente (pas tout l'historique complet).

## 11) Depannage rapide

Si le panneau affiche un fallback heuristique:

- verifier `OPENAI_API_KEY` ou `ANTHROPIC_API_KEY`,
- verifier le modele (`OPENAI_MODEL` recommande: `gpt-4.1-mini`),
- redemarrer le serveur apres modif `.env`,
- verifier `fallbackReason` dans `AiGeneration.metadata`.

Si les conseils sont trop generiques:

- enrichir les resumes interaction,
- verifier/corriger l'auto-analyse,
- completer notes client et budget,
- regenerer un conseil.

## 12) Securite

- ne jamais exposer de cles API en clair,
- si une cle fuit: revoquer et regenerer immediatement.
