import * as cheerio from 'cheerio';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { chromium } from 'playwright';
import { Game, MonthlyGames, MonthlyGamesSchema } from '../src/types/game';
import { RawgDriver } from '../src/drivers/rawg-driver';
import { IgdbDriver } from '../src/drivers/igdb-driver';
import { OpenCriticDriver } from '../src/drivers/opencritic-driver';
import { SteamDriver } from '../src/drivers/steam-driver';

const SKIDROW_BASE_URL = 'https://www.skidrowreloaded.com';
const MIN_RATING = 80;
const MAX_PAGES = 50;

function cleanGameName(name: string): string {
  return name
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Accepte le mois courant ET le mois précédent
function isRecentEnough(dateStr: string): boolean {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  const now = new Date();
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return date >= twoMonthsAgo;
}

// Indique si une date est trop ancienne pour continuer le scraping
function isTooOld(dateStr: string): boolean {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  const now = new Date();
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return date < twoMonthsAgo;
}

function parseDate(raw: string): string | null {
  const cleaned = raw.trim();
  // datetime attribute (ISO)
  const isoMatch = cleaned.match(/\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return isoMatch[0];
  // "January 15, 2026" or "Jan 15, 2026"
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function extractGames($: cheerio.CheerioAPI): Array<{ name: string; url: string; dateStr: string }> {
  const results: Array<{ name: string; url: string; dateStr: string }> = [];

  // Stratégies par ordre de priorité pour trouver les posts
  const postSelectors = ['article', '.post', '.entry', '.item'];
  const titleSelectors = ['.entry-title a', 'h2.title a', '.post-title a', 'h2 a', 'h1 a', '.title a'];
  const dateSelectors = ['time[datetime]', '.entry-date', '.post-date', '.date', 'time', '.published'];

  for (const postSel of postSelectors) {
    const posts = $(postSel);
    if (posts.length === 0) continue;

    posts.each((_, el) => {
      const $el = $(el);

      let title = '';
      let url = '';
      for (const sel of titleSelectors) {
        const found = $el.find(sel).first();
        if (found.length) {
          title = found.text().trim();
          url = found.attr('href') || '';
          if (title && url) break;
        }
      }

      let dateStr = '';
      for (const sel of dateSelectors) {
        const found = $el.find(sel).first();
        if (found.length) {
          const raw = found.attr('datetime') || found.text();
          const parsed = parseDate(raw);
          if (parsed) { dateStr = parsed; break; }
        }
      }

      if (title && url && dateStr) {
        results.push({
          name: cleanGameName(title),
          url: url.startsWith('http') ? url : `${SKIDROW_BASE_URL}${url}`,
          dateStr,
        });
      }
    });

    if (results.length > 0) break;
  }

  return results;
}

async function scrapeAllPages(): Promise<Game[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    extraHTTPHeaders: {
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  const allGames: Game[] = [];

  try {
    const page = await context.newPage();

    for (let currentPage = 1; currentPage <= MAX_PAGES; currentPage++) {
      const url = currentPage === 1
        ? SKIDROW_BASE_URL
        : `${SKIDROW_BASE_URL}/page/${currentPage}`;

      console.log(`📄 Page ${currentPage}: ${url}`);

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
      } catch (err) {
        console.error(`Erreur navigation page ${currentPage}:`, err);
        break;
      }

      const html = await page.content();
      const $ = cheerio.load(html);

      // Log le titre de la page pour détecter Cloudflare ou autres blocages
      const pageTitle = $('title').text().trim();
      console.log(`  → Titre: "${pageTitle}"`);

      const entries = extractGames($);

      if (entries.length === 0) {
        if (currentPage === 1) {
          // Sauvegarder le HTML pour debug si la première page ne retourne rien
          const { writeFileSync } = await import('fs');
          writeFileSync('debug-page1.html', html.slice(0, 10000));
          console.error('⚠️  Page 1 : aucun jeu trouvé. HTML sauvegardé dans debug-page1.html');
        } else {
          console.log(`Aucun jeu trouvé sur la page ${currentPage}, arrêt.`);
        }
        break;
      }

      let foundOld = false;
      for (const entry of entries) {
        if (isTooOld(entry.dateStr)) {
          foundOld = true;
          continue;
        }
        if (isRecentEnough(entry.dateStr)) {
          allGames.push({
            name: entry.name,
            skidrowUrl: entry.url,
            lastUpdated: new Date().toISOString(),
          });
        }
      }

      console.log(`  → ${entries.length} entrées dont ${allGames.length} récentes au total`);

      // Arrêter si on a trouvé des jeux récents ET qu'on commence à voir des vieux
      if (foundOld && allGames.length > 0) {
        console.log('Dates trop anciennes détectées, arrêt du scraping.');
        break;
      }
      // Arrêter aussi si toute la page est trop ancienne (pas la peine de continuer)
      if (foundOld && allGames.length === 0 && currentPage >= 3) {
        console.log('Toutes les entrées sont trop anciennes, arrêt.');
        break;
      }

      await page.waitForTimeout(1000);
    }
  } finally {
    await browser.close();
  }

  return allGames;
}

async function enrichGame(
  game: Game,
  drivers: { steam: SteamDriver; rawg?: RawgDriver; igdb?: IgdbDriver; openCritic?: OpenCriticDriver }
): Promise<Game> {
  console.log(`  🔍 ${game.name}`);
  const calls: Promise<{ type: string; value: string | number | null }>[] = [];

  // Steam en premier — aucune clé requise
  calls.push(drivers.steam.getRating(game.name).then(v => ({ type: 'steamRating', value: v })).catch(() => ({ type: 'steamRating', value: null })));
  calls.push(drivers.steam.getSteamLink(game.name).then(v => ({ type: 'steamLink', value: v })).catch(() => ({ type: 'steamLink', value: null })));
  calls.push(drivers.steam.getReleaseDate(game.name).then(v => ({ type: 'steamDate', value: v })).catch(() => ({ type: 'steamDate', value: null })));

  if (drivers.rawg) {
    calls.push(drivers.rawg.getRating(game.name).then(v => ({ type: 'rawgRating', value: v ?? null })).catch(() => ({ type: 'rawgRating', value: null })));
    calls.push(drivers.rawg.getSteamLink(game.name).then(v => ({ type: 'rawgSteam', value: v ?? null })).catch(() => ({ type: 'rawgSteam', value: null })));
    calls.push(drivers.rawg.getReleaseDate(game.name).then(v => ({ type: 'rawgDate', value: v ?? null })).catch(() => ({ type: 'rawgDate', value: null })));
  }
  if (drivers.igdb) {
    calls.push(drivers.igdb.getRating(game.name).then(v => ({ type: 'igdbRating', value: v ?? null })).catch(() => ({ type: 'igdbRating', value: null })));
    calls.push(drivers.igdb.getSteamLink(game.name).then(v => ({ type: 'igdbSteam', value: v ?? null })).catch(() => ({ type: 'igdbSteam', value: null })));
    calls.push(drivers.igdb.getReleaseDate(game.name).then(v => ({ type: 'igdbDate', value: v ?? null })).catch(() => ({ type: 'igdbDate', value: null })));
  }
  if (drivers.openCritic) {
    calls.push(drivers.openCritic.getRating(game.name).then(v => ({ type: 'ocRating', value: v ?? null })).catch(() => ({ type: 'ocRating', value: null })));
    calls.push(drivers.openCritic.getSteamLink(game.name).then(v => ({ type: 'ocSteam', value: v ?? null })).catch(() => ({ type: 'ocSteam', value: null })));
    calls.push(drivers.openCritic.getReleaseDate(game.name).then(v => ({ type: 'ocDate', value: v ?? null })).catch(() => ({ type: 'ocDate', value: null })));
  }

  const results = await Promise.all(calls);
  const ratings: number[] = [];

  for (const r of results) {
    if (r.value === null) continue;
    if (r.type.endsWith('Rating') && typeof r.value === 'number') {
      ratings.push(r.value);
      if (!game.rating) game.rating = r.value;
    }
    if (r.type.endsWith('Steam') && typeof r.value === 'string' && !game.steamLink) {
      game.steamLink = r.value;
    }
    if (r.type.endsWith('Date') && typeof r.value === 'string' && !game.releaseDate) {
      game.releaseDate = r.value;
    }
  }

  if (ratings.length > 1) {
    game.rating = Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length);
  }

  game.lastUpdated = new Date().toISOString();
  return game;
}

async function main() {
  console.log('🚀 Démarrage de la génération des données...');

  const rawgApiKey = process.env.RAWG_API_KEY;
  const twitchClientId = process.env.TWITCH_CLIENT_ID;
  const twitchClientSecret = process.env.TWITCH_CLIENT_SECRET;
  const openCriticApiKey = process.env.OPENCRITIC_API_KEY;

  const drivers: { steam: SteamDriver; rawg?: RawgDriver; igdb?: IgdbDriver; openCritic?: OpenCriticDriver } = {
    steam: new SteamDriver(),
  };
  console.log('✅ Steam activé (Metacritic + avis utilisateurs, sans clé)');

  if (rawgApiKey) {
    drivers.rawg = new RawgDriver(rawgApiKey);
    console.log('✅ RAWG activé');
  } else {
    console.warn('⚠️  RAWG_API_KEY manquant — notes RAWG désactivées');
  }
  if (twitchClientId && twitchClientSecret) {
    drivers.igdb = new IgdbDriver(twitchClientId, twitchClientSecret);
    console.log('✅ IGDB activé');
  } else {
    console.warn('⚠️  TWITCH_CLIENT_ID/SECRET manquants — notes IGDB désactivées');
  }
  if (openCriticApiKey) {
    drivers.openCritic = new OpenCriticDriver(openCriticApiKey);
    console.log('✅ OpenCritic activé');
  }

  // Steam est toujours actif, pas de warning nécessaire

  // Scraping
  console.log('\n🔎 Scraping de Skidrow...');
  const games = await scrapeAllPages();
  console.log(`\n📊 ${games.length} jeux récupérés`);

  if (games.length === 0) {
    console.warn('⚠️  Aucun jeu récent trouvé (scraping bloqué ou sélecteurs incorrects).');
    console.warn('   Vérifiez debug-page1.html si présent, ou les sélecteurs CSS.');
  }

  // Enrichissement
  console.log('\n🔍 Enrichissement des données...');
  const enriched = await Promise.all(games.map(g => enrichGame(g, drivers)));

  const filtered = enriched.length > 0
    ? enriched.filter(g => g.rating && g.rating >= MIN_RATING)
    : [];

  console.log(`\n✅ ${filtered.length} jeux avec note ≥ ${MIN_RATING}`);

  const month = new Date().toISOString().slice(0, 7);
  const monthlyGames: MonthlyGames = {
    month,
    games: filtered,
    totalCount: filtered.length,
    lastUpdated: new Date().toISOString(),
  };

  const validatedData = MonthlyGamesSchema.parse(monthlyGames);

  const dataDir = join(process.cwd(), 'public', 'data');
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

  const outputPath = join(dataDir, `${month}.json`);
  writeFileSync(outputPath, JSON.stringify(validatedData, null, 2));

  console.log(`\n💾 Données sauvegardées dans ${outputPath}`);
  console.log('🎉 Génération terminée !');
}

main().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
