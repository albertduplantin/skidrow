# 🎮 Skidrow Game Scanner

Application web Next.js pour scanner et lister les jeux de qualité de Skidrow avec enrichissement via des APIs gratuites.

## ✨ Fonctionnalités

- **Scanner automatique** : Récupère les jeux du mois dernier depuis Skidrow
- **Enrichissement des données** : Intègre les notes et liens Steam via RAWG, IGDB et OpenCritic
- **Filtrage intelligent** : Affiche uniquement les jeux avec une note ≥ 80/100
- **Interface moderne** : UI responsive avec Tailwind CSS
- **Pipeline automatisé** : GitHub Actions pour la génération mensuelle des données
- **Architecture modulaire** : Drivers TypeScript pour faciliter l'ajout de nouvelles sources

## 🏗️ Architecture

```
src/
├── app/                 # App Router Next.js
├── drivers/            # Drivers API (RAWG, IGDB, OpenCritic)
├── types/              # Types TypeScript et schémas Zod
└── tests/              # Tests unitaires et e2e

scripts/
└── generate-data.ts    # Script de génération des données

.github/workflows/      # GitHub Actions
├── pipeline.yml        # Pipeline mensuel
└── ci.yml             # CI/CD
```

## 🚀 Installation

### Prérequis

- Node.js 18+
- npm ou yarn
- Clés API pour RAWG, Twitch (IGDB) et optionnellement OpenCritic

### 1. Cloner le projet

```bash
git clone https://github.com/albertduplantin/skidrow.git
cd skidrow
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configuration des variables d'environnement

Créez un fichier `.env.local` :

```env
RAWG_API_KEY=votre_clé_rawg
TWITCH_CLIENT_ID=votre_client_id_twitch
TWITCH_CLIENT_SECRET=votre_client_secret_twitch
OPENCRITIC_API_KEY=votre_clé_opencritic_rapidapi
```

### 4. Obtenir les clés API

#### RAWG
1. Allez sur [RAWG](https://rawg.io/apidocs)
2. Créez un compte et obtenez votre clé API gratuite

#### Twitch (pour IGDB)
1. Allez sur [Twitch Developer Console](https://dev.twitch.tv/console)
2. Créez une nouvelle application
3. Notez le Client ID et Client Secret

#### OpenCritic (optionnel)
1. Allez sur [RapidAPI OpenCritic](https://rapidapi.com/opencritic-opencritic-default/api/opencritic)
2. Souscrivez au plan gratuit
3. Copiez votre clé API

## 🎯 Utilisation

### Développement local

```bash
# Démarrer l'application
npm run dev

# Ouvrir http://localhost:3000
```

### Génération des données

```bash
# Générer les données manuellement
npm run generate-data

# Les données seront sauvegardées dans public/data/YYYY-MM.json
```

### Tests

```bash
# Tests unitaires
npm run test

# Tests avec interface UI
npm run test:ui

# Tests e2e
npm run test:e2e

# Vérification des types
npm run type-check

# Linting
npm run lint
```

## 🔄 Pipeline automatisé

### GitHub Actions

Le projet inclut deux workflows :

1. **Pipeline mensuel** (`.github/workflows/pipeline.yml`)
   - Exécution automatique le 1er du mois à minuit UTC
   - Déclenchement manuel possible
   - Scrape Skidrow et enrichit les données
   - Commit automatique des résultats

2. **CI/CD** (`.github/workflows/ci.yml`)
   - Tests automatiques sur chaque PR
   - Build et déploiement sur la branche main
   - Validation des types et linting

### Configuration des secrets GitHub

Dans votre repository GitHub, ajoutez ces secrets :

- `RAWG_API_KEY`
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `OPENCRITIC_API_KEY`

## 🚀 Déploiement

### Vercel (recommandé)

1. Connectez votre repository GitHub à Vercel
2. Configurez les variables d'environnement
3. Déploiement automatique sur chaque push vers `main`

### Autres plateformes

L'application est statique et peut être déployée sur :
- Netlify
- GitHub Pages
- AWS S3 + CloudFront
- Tout hébergeur statique

## 🧪 Tests

### Tests unitaires (Vitest)

```typescript
// Exemple de test
describe('RawgDriver', () => {
  it('devrait récupérer une note correctement', async () => {
    const driver = new RawgDriver('test-key');
    const rating = await driver.getRating('Test Game');
    expect(rating).toBe(85);
  });
});
```

### Tests e2e (Playwright)

```typescript
test('devrait afficher le titre', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Skidrow Game Scanner');
});
```

## 🔧 Configuration

### Tailwind CSS

Le projet utilise Tailwind CSS pour le styling. Configuration dans `tailwind.config.js`.

### TypeScript

Configuration stricte avec `tsconfig.json` optimisé pour Next.js.

### ESLint

Règles personnalisées dans `.eslintrc.json` pour maintenir la qualité du code.

## 📊 Structure des données

### Format JSON

```json
{
  "month": "2024-12",
  "games": [
    {
      "name": "Nom du jeu",
      "skidrowUrl": "https://...",
      "rating": 85,
      "steamLink": "https://store.steampowered.com/app/...",
      "releaseDate": "2024-12-15",
      "lastUpdated": "2024-12-20T10:00:00.000Z"
    }
  ],
  "totalCount": 1,
  "lastUpdated": "2024-12-20T10:00:00.000Z"
}
```

### Validation Zod

Toutes les données sont validées avec des schémas Zod pour garantir l'intégrité.

## 🤝 Contribution

1. Fork le projet
2. Créez une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

## 📝 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## ⚠️ Avertissements

- **Usage personnel uniquement** : Cette application est conçue pour un usage personnel
- **Respect des APIs** : Respectez les limites de taux des APIs utilisées
- **Scraping responsable** : Le scraping est configuré pour être respectueux avec des délais entre les requêtes

## 🆘 Support

Pour toute question ou problème :

1. Vérifiez les [Issues GitHub](https://github.com/albertduplantin/skidrow/issues)
2. Créez une nouvelle issue si nécessaire
3. Consultez la documentation des APIs utilisées

## 🔮 Roadmap

- [ ] Support de plus de sources de données
- [ ] Interface d'administration pour la configuration
- [ ] Notifications par email des nouveaux jeux
- [ ] API REST pour l'intégration avec d'autres services
- [ ] Support multilingue
- [ ] Mode sombre/clair
- [ ] Filtres avancés (genre, plateforme, etc.)

---

**Développé avec ❤️ pour la communauté gaming**
