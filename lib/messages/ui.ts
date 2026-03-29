export const UI_MESSAGES = {
  auth: {
    signIn: {
      title: "Connexion",
      subtitle:
        "Connecte-toi puis cree ton workspace ou rejoins-en un existant.",
      emailLabel: "Email",
      passwordLabel: "Mot de passe",
      submit: "Se connecter",
      submitting: "Connexion...",
      noAccountPrefix: "Pas encore de compte ?",
      noAccountCta: "Inscription",
    },
    signUp: {
      title: "Inscription",
      subtitle:
        "Créé ton compte puis configure ton workspace à l'étape suivante.",
      nameLabel: "Nom",
      emailLabel: "Email",
      passwordLabel: "Mot de passe",
      submit: "Créer mon compte",
      submitting: "Création...",
      hasAccountPrefix: "Déjà inscrit ?",
      hasAccountCta: "Connexion",
    },
  },
  workspace: {
    onboarding: {
      pageTitle: "Bienvenue",
      pageSubtitle:
        "Ton compte est créé. Maintenant, crée un workspace ou rejoins-en un existant.",
    },
    create: {
      title: "Créer un workspace",
      subtitle: "Crée ton propre espace de travail, puis invite ton équipe.",
      nameLabel: "Nom du workspace",
      namePlaceholder: "Ex: Studio Nova",
      submit: "Créer",
      submitting: "Création...",
    },
    join: {
      title: "Rejoindre un workspace",
      subtitle:
        "Entre un identifiant de workspace existant pour y être ajouté comme membre.",
      idLabel: "Workspace ID",
      idPlaceholder: "cuid du workspace",
      submit: "Rejoindre",
      submitting: "Connexion...",
    },
  },
  dashboard: {
    title: "Dashboard",
    connectedAsPrefix: "Connecté en tant que",
    signOut: "Se déconnecter",
    workspacesTitle: "Tes workspaces",
    rolePrefix: "Rôle :",
    idPrefix: "ID :",
  },
} as const;
