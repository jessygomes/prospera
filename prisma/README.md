# Modele de donnees CRM - Prisma

Ce document explique la modelisation de l'application CRM/prospection.

## Objectif produit

L'application centralise:

- prospection commerciale
- gestion des clients
- suivi des projets
- facturation
- documents
- operations IA

Le tout est pense pour des freelances, agences et petites equipes.

## Principe cle: multi-tenant par workspace

Chaque donnee metier est rattachee a un workspace.

Concretement:

- un utilisateur peut appartenir a plusieurs workspaces
- son role est defini par workspace
- les donnees metier sont filtrees par workspaceId

Modeles concernes:

- Workspace
- WorkspaceMember
- Client
- ClientAction
- ClientNote
- Project
- Invoice
- InvoiceItem
- Document
- AiGeneration
- ClientStatusHistory
- ProjectStatusHistory

## Utilisateurs et droits

User:

- profil global utilisateur (email unique, avatar, dates)

WorkspaceMember:

- table de jointure User <-> Workspace
- role par workspace: OWNER, ADMIN, MEMBER
- contrainte unique userId + workspaceId

Interet:

- un meme compte utilisateur peut collaborer sur plusieurs structures
- les permissions restent scopees au workspace

## CRM clients et pipeline commercial

Client stocke:

- identite (nom, email, telephone, entreprise, site)
- donnees commerciales (status, priority, source, budgetEstimated)
- suivi (lastContactAt, nextFollowUpAt)
- organisation (tags, note globale)

Pipeline ClientStatus:

- PROSPECT
- CONTACTED
- QUALIFIED
- PROPOSAL_SENT
- NEGOTIATION
- WON
- LOST
- INACTIVE

Tables associees:

- ClientAction: actions commerciales (call, email, relance, meeting, proposition)
- ClientNote: notes chronologiques + note epinglee
- ClientStatusHistory: transitions de statut pour analytics conversion

## Prospection et execution commerciale

ClientAction permet de gerer la to-do commerciale:

- status: TODO, DONE, CANCELED
- dueDate pour actions du jour/en retard
- doneAt pour date de completion
- createdById et assignedToId pour fonctionnement en equipe

Indexes ajoutes pour les vues metier:

- actions a faire par workspace
- actions en retard
- to-do par collaborateur

## Projets

Project stocke:

- nom, description
- statut (PROSPECT, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELED)
- pricingType (FIXED ou HOURLY)
- budgetEstimated, budgetFinal, hourlyRate
- dates (startDate, deadline, completedAt)

Historisation:

- ProjectStatusHistory enregistre chaque transition
- utile pour pilotage, prevision et post-mortem commercial

## Facturation et precision financiere

Invoice:

- numero de facture
- statut (DRAFT, SENT, PAID, OVERDUE, CANCELED)
- dates (issueDate, dueDate, paidAt)
- montants (subtotal, taxRate, taxAmount, total)
- currency (par defaut EUR)

Choix important:

- montants en Decimal, pas en Float, pour eviter les erreurs d'arrondi

Unicite facture:

- invoiceNumber est unique par workspace (workspaceId + invoiceNumber)
- evite les collisions entre comptes differents

InvoiceItem:

- lignes de facture (quantite, prix unitaire, total)
- montants egalement en Decimal
- sortOrder pour maitriser l'ordre d'affichage PDF/UI

## Documents

Document centralise les fichiers metier:

- contrat, devis, facture, brief, livrable, autre
- lien possible vers client, projet et/ou facture
- url de stockage externe (S3, Cloudinary, etc.)
- uploadedById pour l'audit interne

## IA et observabilite

AiGeneration conserve l'historique des generations:

- type (email client, resume, suggestion prix)
- prompt et resultat
- liens metier optionnels vers client/projet
- auteur via createdById

Champs de suivi IA:

- provider, model
- inputTokens, outputTokens, totalTokens
- costUsd
- metadata JSON libre

Interet:

- suivi des couts IA
- analyse de performance par usage

## Historique de statut et analytics

Deux tables d'evenements:

- ClientStatusHistory
- ProjectStatusHistory

Chaque evenement contient:

- fromStatus
- toStatus
- changedById
- changedAt
- note

Ces tables servent a:

- calculer le taux de conversion
- mesurer le temps passe par etape
- detecter les blocages et opportunites

## Indexation orientee produit

Le schema inclut des indexes metier pour accelerer:

- clients a relancer
- actions du jour / en retard
- factures par statut et echeance
- historiques recents par workspace

## Regles de developpement recommandees

Dans le code applicatif:

- toujours filtrer par workspaceId
- verifier les permissions via WorkspaceMember.role
- lors d'un changement de statut, ecrire aussi une entree dans la table History correspondante
- pour la finance, manipuler Decimal de bout en bout

## Etat actuel

Le schema est valide Prisma.

Commandes utiles:

- npx prisma validate
- npx prisma generate

Comme aucune migration n'a encore ete appliquee en base, la modelisation peut encore evoluer sans dette de migration historique.
