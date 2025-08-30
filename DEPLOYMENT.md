# 🚀 Guide de déploiement complet

## 📋 Résumé du projet

**Skidrow Game Scanner** est une application web Next.js complète qui :
- Scrape automatiquement le site Skidrow pour les nouveaux jeux
- Enrichit les données via des APIs gratuites (RAWG, IGDB, OpenCritic)
- Filtre les jeux avec une note ≥ 80/100
- Génère des données statiques via GitHub Actions
- S'affiche dans une interface moderne et responsive

## 🎯 Fonctionnalités implémentées

✅ **Architecture complète** : Next.js 14 + TypeScript + Tailwind CSS  
✅ **Drivers API modulaires** : RAWG, IGDB (via Twitch), OpenCritic  
✅ **Pipeline automatisé** : GitHub Actions avec cron mensuel  
✅ **Tests complets** : Unitaires (Vitest) + E2E (Playwright)  
✅ **Validation des données** : Schémas Zod pour l'intégrité  
✅ **Interface utilisateur** : Design moderne avec composants React  
✅ **Configuration CI/CD** : Linting, tests, build automatisés  
✅ **Déploiement Vercel** : Configuration prête pour l'hébergement gratuit  

## 🔧 Installation et configuration

### 1. Cloner et installer
```bash
git clone https://github.com/albertduplantin/skidrow.git
cd skidrow
npm install
```

### 2. Variables d'environnement
Créez `.env.local` :
```env
RAWG_API_KEY=votre_clé_rawg
TWITCH_CLIENT_ID=votre_client_id_twitch
TWITCH_CLIENT_SECRET=votre_client_secret_twitch
OPENCRITIC_API_KEY=votre_clé_opencritic_rapidapi
```

### 3. Obtenir les clés API
- **RAWG** : [rawg.io/apidocs](https://rawg.io/apidocs) - Compte gratuit
- **Twitch** : [dev.twitch.tv/console](https://dev.twitch.tv/console) - Application OAuth
- **OpenCritic** : [RapidAPI](https://rapidapi.com/opencritic-opencritic-default/api/opencritic) - Plan gratuit

## 🚀 Déploiement

### Option 1 : Vercel (recommandé)

1. **Connecter le repository**
   - Allez sur [vercel.com](https://vercel.com)
   - Importez votre repository GitHub
   - Vercel détectera automatiquement Next.js

2. **Configurer les variables d'environnement**
   - Dans votre projet Vercel
   - Ajoutez toutes les variables d'API requises
   - Redéployez

3. **Déploiement automatique**
   - Chaque push vers `main` déclenche un déploiement
   - Les previews sont créés sur chaque PR

### Option 2 : GitHub Pages

1. **Configurer GitHub Actions**
   - Les workflows sont déjà configurés
   - Ajoutez les secrets GitHub requis

2. **Activer GitHub Pages**
   - Dans les paramètres du repository
   - Source : GitHub Actions

### Option 3 : Autres plateformes

L'application est statique et peut être déployée sur :
- Netlify
- AWS S3 + CloudFront
- Tout hébergeur statique

## 🔄 Pipeline automatisé

### GitHub Actions configurés

1. **Pipeline mensuel** (`.github/workflows/pipeline.yml`)
   - Exécution : 1er du mois à minuit UTC
   - Action : Scrape Skidrow + enrichissement APIs
   - Résultat : Commit automatique des données JSON

2. **CI/CD** (`.github/workflows/ci.yml`)
   - Déclenchement : Sur chaque PR et push
   - Actions : Tests, linting, build
   - Déploiement : Automatique sur `main`

### Configuration des secrets GitHub

Dans votre repository GitHub → Settings → Secrets and variables → Actions :

```
RAWG_API_KEY=votre_clé_rawg
TWITCH_CLIENT_ID=votre_client_id_twitch
TWITCH_CLIENT_SECRET=votre_client_secret_twitch
OPENCRITIC_API_KEY=votre_clé_opencritic_rapidapi
```

## 🧪 Tests et qualité

### Tests unitaires
```bash
npm run test          # Tous les tests
npm run test:ui       # Interface graphique
npm run test:watch    # Mode watch
```

### Tests e2e
```bash
npm run test:e2e      # Tests Playwright
npx playwright test --ui  # Interface graphique
```

### Qualité du code
```bash
npm run lint          # ESLint
npm run type-check    # TypeScript
npm run build         # Build de production
```

## 📊 Structure des données

### Fichiers générés
- **Localisation** : `public/data/YYYY-MM.json`
- **Format** : JSON validé avec Zod
- **Contenu** : Jeux filtrés avec notes ≥ 80/100

### Exemple de données
```json
{
  "month": "2025-01",
  "games": [
    {
      "name": "Nom du jeu",
      "rating": 85,
      "steamLink": "https://store.steampowered.com/app/...",
      "releaseDate": "2025-01-15"
    }
  ],
  "totalCount": 1,
  "lastUpdated": "2025-01-20T10:00:00.000Z"
}
```

## 🔍 Monitoring et maintenance

### Logs et surveillance
- **GitHub Actions** : Historique des exécutions
- **Vercel** : Analytics et performances
- **Console** : Logs de scraping et enrichissement

### Mise à jour des données
- **Automatique** : 1er du mois via GitHub Actions
- **Manuel** : Déclenchement manuel dans GitHub
- **Local** : `npm run generate-data`

## 🚨 Dépannage

### Problèmes courants

1. **Erreur de clé API**
   - Vérifiez les variables d'environnement
   - Testez les clés individuellement

2. **Échec du scraping**
   - Vérifiez la structure du site Skidrow
   - Adaptez les sélecteurs CSS si nécessaire

3. **Limites d'API atteintes**
   - Respectez les quotas gratuits
   - Ajoutez des délais entre les requêtes

4. **Build échoue**
   - Vérifiez les types TypeScript
   - Corrigez les erreurs ESLint

### Support
- **Issues GitHub** : [github.com/albertduplantin/skidrow/issues](https://github.com/albertduplantin/skidrow/issues)
- **Documentation** : README.md détaillé
- **Tests** : Exécutez `npm run test` pour diagnostiquer

## 🎉 Félicitations !

Votre application **Skidrow Game Scanner** est maintenant :
- ✅ **Complètement fonctionnelle**
- ✅ **Prête pour la production**
- ✅ **Automatisée et maintenue**
- ✅ **Testée et validée**
- ✅ **Déployable gratuitement**

L'application scannera automatiquement Skidrow chaque mois et enrichira les données avec les meilleures APIs de jeux, le tout avec une interface moderne et responsive !

---

**Développé avec ❤️ pour la communauté gaming**  
*Projet open source sous licence MIT*
