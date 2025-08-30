# Configuration Vercel

## Variables d'environnement à configurer

Dans votre projet Vercel, ajoutez ces variables d'environnement :

### Variables requises
- `RAWG_API_KEY` : Votre clé API RAWG
- `TWITCH_CLIENT_ID` : Votre Client ID Twitch
- `TWITCH_CLIENT_SECRET` : Votre Client Secret Twitch

### Variables optionnelles
- `OPENCRITIC_API_KEY` : Votre clé API OpenCritic (RapidAPI)

## Configuration du déploiement

1. Connectez votre repository GitHub à Vercel
2. Configurez les variables d'environnement ci-dessus
3. Le déploiement se fera automatiquement sur chaque push vers `main`

## Notes importantes

- L'application utilise le runtime Edge de Next.js
- Les données sont générées statiquement via GitHub Actions
- Aucune base de données n'est requise
- L'application est entièrement statique après le build
