import * as cheerio from 'cheerio';
import axios from 'axios';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import retry from 'retry';
import { Game, GameSchema, MonthlyGames, MonthlyGamesSchema } from '../src/types/game';
import { RawgDriver } from '../src/drivers/rawg-driver';
import { IgdbDriver } from '../src/drivers/igdb-driver';
import { OpenCriticDriver } from '../src/drivers/opencritic-driver';

// Configuration
const SKIDROW_BASE_URL = 'https://www.skidrowreloaded.com';
const MIN_RATING = 80; // Note minimale pour filtrer les jeux
const MAX_PAGES = 50; // Limite de pages pour éviter les boucles infinies

// Fonction utilitaire pour retry avec exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  const operation = retry.operation({
    retries: maxAttempts,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 10000,
  });

  return new Promise((resolve, reject) => {
    operation.attempt(async (currentAttempt) => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        console.log(`Tentative ${currentAttempt} échouée:`, error);
        if (operation.retry(error as Error)) {
          return;
        }
        reject(operation.mainError());
      }
    });
  });
}

// Fonction pour nettoyer le nom du jeu
function cleanGameName(name: string): string {
  return name
    .replace(/\[.*?\]/g, '') // Supprimer les crochets et leur contenu
    .replace(/\(.*?\)/g, '') // Supprimer les parenthèses et leur contenu
    .replace(/\./g, ' ') // Remplacer les points par des espaces
    .replace(/\s+/g, ' ') // Normaliser les espaces
    .trim();
}

// Fonction pour vérifier si une date est dans le mois dernier
function isLastMonth(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  return date >= lastMonth && date < thisMonth;
}

// Fonction pour scraper une page de Skidrow
async function scrapeSkidrowPage(pageUrl: string): Promise<Game[]> {
  try {
    const response = await withRetry(() => 
      axios.get(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      })
    );

    const $ = cheerio.load(response.data);
    const games: Game[] = [];

    // Sélecteur pour les jeux (à adapter selon la structure du site)
    $('.post').each((_, element) => {
      const $element = $(element);
      const titleElement = $element.find('.title a');
      const title = titleElement.text().trim();
      const url = titleElement.attr('href');
      const dateElement = $element.find('.date');
      const dateStr = dateElement.text().trim();

      if (title && url && dateStr) {
        const cleanTitle = cleanGameName(title);
        const game: Game = {
          name: cleanTitle,
          skidrowUrl: url.startsWith('http') ? url : `${SKIDROW_BASE_URL}${url}`,
          lastUpdated: new Date().toISOString(),
        };

        // Vérifier si la date est dans le mois dernier
        if (isLastMonth(dateStr)) {
          games.push(game);
        }
      }
    });

    return games;
  } catch (error) {
    console.error(`Erreur lors du scraping de ${pageUrl}:`, error);
    return [];
  }
}

// Fonction pour enrichir un jeu avec les données des APIs
async function enrichGame(game: Game, drivers: {
  rawg: RawgDriver;
  igdb: IgdbDriver;
  openCritic: OpenCriticDriver;
}): Promise<Game> {
  console.log(`Enrichissement de: ${game.name}`);

  try {
    // Récupérer les données en parallèle
    const [rawgRating, rawgSteam, rawgDate, igdbRating, igdbSteam, igdbDate, openCriticRating, openCriticSteam, openCriticDate] = await Promise.allSettled([
      drivers.rawg.getRating(game.name),
      drivers.rawg.getSteamLink(game.name),
      drivers.rawg.getReleaseDate(game.name),
      drivers.igdb.getRating(game.name),
      drivers.igdb.getSteamLink(game.name),
      drivers.igdb.getReleaseDate(game.name),
      drivers.openCritic.getRating(game.name),
      drivers.openCritic.getSteamLink(game.name),
      drivers.openCritic.getReleaseDate(game.name),
    ]);

    // Appliquer les données récupérées
    if (rawgRating.status === 'fulfilled' && rawgRating.value) {
      game.rating = rawgRating.value;
    }
    if (rawgSteam.status === 'fulfilled' && rawgSteam.value) {
      game.steamLink = rawgSteam.value;
    }
    if (rawgDate.status === 'fulfilled' && rawgDate.value) {
      game.releaseDate = rawgDate.value;
    }
    if (igdbRating.status === 'fulfilled' && igdbRating.value) {
      game.rating = game.rating || igdbRating.value;
    }
    if (igdbSteam.status === 'fulfilled' && igdbSteam.value) {
      game.steamLink = game.steamLink || igdbSteam.value;
    }
    if (igdbDate.status === 'fulfilled' && igdbDate.value) {
      game.releaseDate = game.releaseDate || igdbDate.value;
    }
    if (openCriticRating.status === 'fulfilled' && openCriticRating.value) {
      game.rating = game.rating || openCriticRating.value;
    }
    if (openCriticSteam.status === 'fulfilled' && openCriticSteam.value) {
      game.steamLink = game.steamLink || openCriticSteam.value;
    }
    if (openCriticDate.status === 'fulfilled' && openCriticDate.value) {
      game.releaseDate = game.releaseDate || openCriticDate.value;
    }

    // Calculer la note moyenne si plusieurs sources
    const ratings = [game.rating].filter(Boolean) as number[];
    if (ratings.length > 1) {
      game.rating = Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length);
    }

    game.lastUpdated = new Date().toISOString();
  } catch (error) {
    console.error(`Erreur lors de l'enrichissement de ${game.name}:`, error);
  }

  return game;
}

// Fonction principale
async function main() {
  console.log('🚀 Démarrage de la génération des données...');

  // Vérifier les variables d'environnement
  const rawgApiKey = process.env.RAWG_API_KEY;
  const twitchClientId = process.env.TWITCH_CLIENT_ID;
  const twitchClientSecret = process.env.TWITCH_CLIENT_SECRET;
  const openCriticApiKey = process.env.OPENCRITIC_API_KEY;

  if (!rawgApiKey || !twitchClientId || !twitchClientSecret) {
    console.error('❌ Variables d\'environnement manquantes. Vérifiez RAWG_API_KEY, TWITCH_CLIENT_ID, et TWITCH_CLIENT_SECRET.');
    process.exit(1);
  }

  // Initialiser les drivers
  const drivers = {
    rawg: new RawgDriver(rawgApiKey),
    igdb: new IgdbDriver(twitchClientId, twitchClientSecret),
    openCritic: new OpenCriticDriver(openCriticApiKey || ''),
  };

  try {
    const allGames: Game[] = [];
    let currentPage = 1;
    let hasMorePages = true;

    // Scraper toutes les pages jusqu'à ce qu'on trouve des dates trop anciennes
    while (hasMorePages && currentPage <= MAX_PAGES) {
      console.log(`📄 Scraping de la page ${currentPage}...`);
      
      const pageUrl = currentPage === 1 
        ? SKIDROW_BASE_URL 
        : `${SKIDROW_BASE_URL}/page/${currentPage}`;
      
      const pageGames = await scrapeSkidrowPage(pageUrl);
      
      if (pageGames.length === 0) {
        console.log(`Aucun jeu trouvé sur la page ${currentPage}, arrêt du scraping.`);
        hasMorePages = false;
      } else {
        allGames.push(...pageGames);
        console.log(`${pageGames.length} jeux trouvés sur la page ${currentPage}`);
        currentPage++;
        
        // Attendre un peu entre les pages pour être respectueux
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`📊 Total de jeux trouvés: ${allGames.length}`);

    // Enrichir les jeux avec les données des APIs
    console.log('🔍 Enrichissement des données...');
    const enrichedGames = await Promise.all(
      allGames.map(game => enrichGame(game, drivers))
    );

    // Filtrer les jeux avec une note >= 80
    const filteredGames = enrichedGames.filter(game => 
      game.rating && game.rating >= MIN_RATING
    );

    console.log(`✅ Jeux avec note >= ${MIN_RATING}: ${filteredGames.length}`);

    // Créer l'objet final
    const month = new Date().toISOString().slice(0, 7); // Format YYYY-MM
    const monthlyGames: MonthlyGames = {
      month,
      games: filteredGames,
      totalCount: filteredGames.length,
      lastUpdated: new Date().toISOString(),
    };

    // Valider avec Zod
    const validatedData = MonthlyGamesSchema.parse(monthlyGames);

    // Créer le dossier public/data s'il n'existe pas
    const dataDir = join(process.cwd(), 'public', 'data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    // Sauvegarder le fichier JSON
    const outputPath = join(dataDir, `${month}.json`);
    writeFileSync(outputPath, JSON.stringify(validatedData, null, 2));
    
    console.log(`💾 Données sauvegardées dans ${outputPath}`);
    console.log('🎉 Génération terminée avec succès !');

  } catch (error) {
    console.error('❌ Erreur lors de la génération:', error);
    process.exit(1);
  }
}

// Exécuter le script
if (require.main === module) {
  main().catch(console.error);
}
