import * as cheerio from 'cheerio';
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { chromium } from 'playwright';
import { Game, MonthlyGames, MonthlyGamesSchema } from '../src/types/game';
import { RawgDriver } from '../src/drivers/rawg-driver';
import { IgdbDriver } from '../src/drivers/igdb-driver';
import { OpenCriticDriver } from '../src/drivers/opencritic-driver';
import { SteamDriver } from '../src/drivers/steam-driver';

const SKIDROW_BASE_URL = 'https://www.skidrowreloaded.com';
const MIN_RATING = 80;
const MAX_PAGES = 15;
const KEEP_DAYS = 60; // durée de conservation d'un jeu dans la liste
const SCRIPT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes max

// Quitter automatiquement si le script tourne trop longtemps
const scriptTimer = setTimeout(() => {
  console.error('⏱️ Timeout : le script a dépassé 30 minutes, arrêt forcé.');
  process.exit(1);
}, SCRIPT_TIMEOUT_MS);

// Jeux déjà collectés lors des exécutions précédentes (le flux RSS ne contient
// que les derniers articles : on accumule au fil des jours)
function loadPreviousGames(dataDir: string): Game[] {
  if (!existsSync(dataDir)) return [];
  const files = readdirSync(dataDir).filter(f => /^\d{4}-\d{2}\.json$/.test(f)).sort().slice(-2);
  const out: Game[] = [];
  for (const f of files) {
    try {
      const parsed = MonthlyGamesSchema.parse(JSON.parse(readFileSync(join(dataDir, f), 'utf-8')));
      out.push(...parsed.games);
    } catch { /* fichier invalide ignoré */ }
  }
  return out;
}

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

// Extrait la date depuis une URL WordPress (/2026/05/23/ ou /2026/05/)
function extractDateFromUrl(url: string): string | null {
  const m = url.match(/\/(\d{4})\/(\d{2})(?:\/(\d{2}))?/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3] ?? '01'}`;
}

// Scrape le flux RSS WordPress (données structurées, pas de CSS selector)
async function scrapeViaRSS(page: import('playwright').Page): Promise<Game[]> {
  const feedUrl = `${SKIDROW_BASE_URL}/feed/`;
  console.log(`📡 RSS: ${feedUrl}`);

  await page.goto(feedUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  const content = await page.content();
  const $rss = cheerio.load(content, { xmlMode: true });
  const items = $rss('item');
  console.log(`  → ${items.length} items dans le flux RSS`);

  if (items.length === 0) {
    writeFileSync('debug-rss.html', content.slice(0, 50000));
    console.warn('⚠️  Flux RSS vide. debug-rss.html sauvegardé.');
    return [];
  }

  const games: Game[] = [];
  items.each((_, el) => {
    const $el = $rss(el);
    const title = $el.find('title').first().text().trim();
    const link = $el.find('link').first().text().trim() || $el.find('guid').first().text().trim();
    const pubDate = $el.find('pubDate').first().text().trim();

    if (!title || !link) return;

    const dateStr = pubDate ? parseDate(pubDate) : extractDateFromUrl(link);
    if (!dateStr || isTooOld(dateStr) || !isRecentEnough(dateStr)) return;

    games.push({
      name: cleanGameName(title),
      skidrowUrl: link,
      postedDate: dateStr,
      lastUpdated: new Date().toISOString(),
    });
  });

  return games;
}

// Fallback HTML : extrait les jeux depuis les liens dont l'URL contient une date WordPress
function extractGamesFromLinks($: cheerio.CheerioAPI): Array<{ name: string; url: string; dateStr: string }> {
  const results: Array<{ name: string; url: string; dateStr: string }> = [];
  const seen = new Set<string>();

  $(`a[href*="${SKIDROW_BASE_URL}/20"]`).each((_, el) => {
    const $el = $(el);
    const href = ($el.attr('href') || '').trim();
    const text = $el.text().trim();

    if (!href || !text || seen.has(href)) return;

    const dateStr = extractDateFromUrl(href);
    if (!dateStr) return;

    seen.add(href);
    results.push({ name: cleanGameName(text), url: href, dateStr });
  });

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

  try {
    const page = await context.newPage();

    // 1. Essai RSS (le plus fiable — données structurées WordPress)
    try {
      const rssGames = await scrapeViaRSS(page);
      if (rssGames.length > 0) {
        console.log(`✅ RSS: ${rssGames.length} jeux récents`);
        return rssGames;
      }
    } catch (err) {
      console.warn('⚠️  RSS échoué, passage au scraping HTML:', (err as Error).message);
    }

    // 2. Fallback HTML : extraction par URL WordPress datée
    console.log('📄 Fallback HTML...');
    const allGames: Game[] = [];

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

      const pageTitle = $('title').text().trim();
      console.log(`  → Titre: "${pageTitle}"`);

      const entries = extractGamesFromLinks($);
      console.log(`  → ${entries.length} liens datés trouvés`);

      if (entries.length === 0 && currentPage === 1) {
        writeFileSync('debug-page1.html', html.slice(0, 100000));
        console.error('⚠️  Page 1 : aucun lien daté. debug-page1.html sauvegardé.');
        // Diagnostic : montrer les liens skidrow disponibles
        const sample = $('a[href*="skidrowreloaded"]').slice(0, 10)
          .map((_, el) => `${$(el).text().trim().slice(0, 50)} → ${$(el).attr('href')}`).get();
        console.log('Liens skidrow (10 premiers):\n ', sample.join('\n  '));
        break;
      }

      let foundOld = false;
      for (const entry of entries) {
        if (isTooOld(entry.dateStr)) { foundOld = true; continue; }
        if (isRecentEnough(entry.dateStr)) {
          allGames.push({ name: entry.name, skidrowUrl: entry.url, postedDate: entry.dateStr, lastUpdated: new Date().toISOString() });
        }
      }

      console.log(`  → ${allGames.length} jeux récents au total`);

      if (foundOld && allGames.length > 0) {
        console.log('Dates trop anciennes détectées, arrêt.');
        break;
      }
      if (entries.length === 0) break;

      await page.waitForTimeout(1000);
    }

    return allGames;
  } finally {
    await browser.close();
  }
}

async function enrichGame(
  game: Game,
  drivers: { steam: SteamDriver; rawg?: RawgDriver; igdb?: IgdbDriver; openCritic?: OpenCriticDriver }
): Promise<Game> {
  console.log(`  🔍 ${game.name}`);
  const calls: Promise<{ type: string; value: string | number | null }>[] = [];

  // Steam en premier — aucune clé requise (une seule recherche, résultat mis en cache)
  const steam = await drivers.steam.getDetails(game.name).catch(() => null);
  game.rating = undefined;
  if (steam) {
    game.steamLink = steam.link;
    game.steamAppId = steam.appId;
    if (steam.releaseDate) game.releaseDate = steam.releaseDate;
    if (steam.metascore !== undefined) game.metacriticScore = steam.metascore;
    if (steam.percentPositive !== undefined) {
      game.steamPercent = steam.percentPositive;
      game.steamReviewCount = steam.reviewCount;
      game.steamReviewLabel = steam.reviewLabel;
    }
    const steamRating = steam.metascore ?? steam.percentPositive;
    if (steamRating !== undefined) calls.push(Promise.resolve({ type: 'steamRating', value: steamRating }));
  }

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

  const dataDir = join(process.cwd(), 'public', 'data');
  const previous = loadPreviousGames(dataDir);
  console.log(`📚 ${previous.length} jeux déjà connus`);

  // Enrichissement séquentiel (évite de bloquer sur des requêtes parallèles sans timeout)
  console.log('\n🔍 Enrichissement des données...');
  const merged = new Map<string, Game>();
  for (const g of previous) merged.set(g.skidrowUrl, g);
  for (const g of games) {
    // Les nouveaux articles écrasent les anciens, les notes sont recalculées
    merged.set(g.skidrowUrl, await enrichGame({ ...merged.get(g.skidrowUrl), ...g }, drivers));
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - KEEP_DAYS);
  const filtered = Array.from(merged.values())
    .filter(g => g.rating && g.rating >= MIN_RATING)
    .filter(g => !g.postedDate || new Date(g.postedDate) >= cutoff)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  console.log(`\n✅ ${filtered.length} jeux avec note ≥ ${MIN_RATING}`);

  const month = new Date().toISOString().slice(0, 7);
  const monthlyGames: MonthlyGames = {
    month,
    games: filtered,
    totalCount: filtered.length,
    lastUpdated: new Date().toISOString(),
  };

  const validatedData = MonthlyGamesSchema.parse(monthlyGames);

  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

  const outputPath = join(dataDir, `${month}.json`);
  writeFileSync(outputPath, JSON.stringify(validatedData, null, 2));

  clearTimeout(scriptTimer);
  console.log(`\n💾 Données sauvegardées dans ${outputPath}`);
  console.log('🎉 Génération terminée !');
}

main().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
