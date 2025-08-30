# Tests locaux

## Configuration des tests

### Tests unitaires (Vitest)

```bash
# Lancer tous les tests
npm run test

# Lancer les tests avec interface UI
npm run test:ui

# Lancer les tests en mode watch
npm run test -- --watch
```

### Tests e2e (Playwright)

```bash
# Installer les navigateurs (première fois)
npx playwright install

# Lancer tous les tests e2e
npm run test:e2e

# Lancer les tests e2e en mode UI
npx playwright test --ui
```

## Configuration des mocks

Les tests utilisent des mocks pour :
- `axios` : Requêtes HTTP
- `cheerio` : Parsing HTML
- `fs` : Système de fichiers
- `path` : Manipulation de chemins

## Structure des tests

```
tests/
├── setup.ts              # Configuration globale des tests
├── unit/                 # Tests unitaires
│   └── drivers.test.ts   # Tests des drivers API
└── e2e/                  # Tests end-to-end
    └── home.spec.ts      # Tests de la page d'accueil
```

## Notes importantes

- Les tests e2e nécessitent que l'application soit en cours d'exécution
- Utilisez `npm run dev` dans un autre terminal avant de lancer les tests e2e
- Les tests unitaires sont isolés et ne nécessitent pas de serveur
