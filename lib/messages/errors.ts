export const ERROR_MESSAGES = {
  common: {
    invalidData: "Donnees invalides.",
  },
  auth: {
    invalidEmail: "Email invalide.",
    passwordRequired: "Mot de passe requis.",
    passwordTooShort: "Le mot de passe doit contenir au moins 8 caracteres.",
    invalidCredentials: "Email ou mot de passe invalide.",
    accountAlreadyExists: "Un compte existe deja avec cet email.",
    autoSignInFailed:
      "Compte cree, mais connexion automatique impossible. Connecte-toi manuellement.",
    nameTooShort: "Le nom doit contenir au moins 2 caracteres.",
  },
  workspace: {
    nameTooShort: "Le nom du workspace doit contenir au moins 2 caracteres.",
    idRequired: "Indique un identifiant de workspace.",
    notFound: "Workspace introuvable.",
  },
} as const;
