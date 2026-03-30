export const ERROR_MESSAGES = {
  common: {
    invalidData: "Donnees invalides.",
  },
  auth: {
    invalidEmail: "Email invalide.",
    passwordRequired: "Mot de passe requis.",
    passwordTooShort: "Le mot de passe doit contenir au moins 8 caracteres.",
    passwordsDoNotMatch: "Les mots de passe ne correspondent pas.",
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
  client: {
    nameRequired: "Le nom du client est requis.",
    invalidWebsite: "URL de site invalide.",
    invalidBudget: "Le budget doit etre un nombre positif.",
    notFound: "Client introuvable.",
    accessDenied: "Vous n'avez pas acces a ce client.",
  },
} as const;
