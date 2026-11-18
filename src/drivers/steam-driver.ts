import axios from 'axios';
import { ApiDriver } from '../types/game';

export interface SteamDetails {
  appId: number;
  link: string;
  /** Score Metacritic (via Steam) si disponible */
  metascore?: number;
  /** % d'avis utilisateurs positifs */
  percentPositive?: number;
  reviewCount?: number;
  reviewLabel?: string;
  /** YYYY-MM-DD */
  releaseDate?: string;
}

const MIN_REVIEWS = 50;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// GET avec retry/backoff (Steam renvoie 429/5xx sous charge)
async function getWithRetry<T = any>(url: string, params: Record<string, unknown>, tries = 3): Promise<T | null> {
  for (let i = 0; i < tries; i++) {
    try {
      const resp = await axios.get<T>(url, { params, timeout: 15000, maxRedirects: 0 });
      return resp.data;
    } catch (err: any) {
      const status = err?.response?.status;
      // 3xx : endpoint redirigé (ex. ancien /appreviews) → inutile de réessayer
      if (status && status >= 300 && status < 400) return null;
      if (i === tries - 1) return null;
      await sleep(1500 * (i + 1));
    }
  }
  return null;
}

export class SteamDriver implements ApiDriver {
  private cache = new Map<string, Promise<SteamDetails | null>>();

  private async findAppId(name: string): Promise<{ id: number; metascore?: number } | null> {
    const data = await getWithRetry<any>('https://store.steampowered.com/api/storesearch/', {
      term: name,
      l: 'english',
      cc: 'US',
    });
    const items: Array<{ id: number; name: string; type?: string; metascore?: string }> =
      (data?.items ?? []).filter((i: any) => !i.type || i.type === 'app');
    if (!items.length) return null;

    const target = normalize(name);
    const exact = items.find(i => normalize(i.name) === target);
    // Sinon : accepter uniquement un titre qui commence par / contient le nom cherché,
    // pour éviter d'associer un jeu sans rapport.
    const loose = items.find(i => {
      const n = normalize(i.name);
      return n.startsWith(target) || target.startsWith(n) || n.includes(target);
    });
    const hit = exact ?? loose;
    if (!hit) return null;
    const ms = hit.metascore ? parseInt(hit.metascore, 10) : NaN;
    return { id: hit.id, metascore: isNaN(ms) ? undefined : ms };
  }

  /** Récupère toutes les infos Steam en une seule recherche + un seul appel détails. */
  getDetails(name: string): Promise<SteamDetails | null> {
    const key = normalize(name);
    let p = this.cache.get(key);
    if (!p) {
      p = this.fetchDetails(name);
      this.cache.set(key, p);
    }
    return p;
  }

  private async fetchDetails(name: string): Promise<SteamDetails | null> {
    const found = await this.findAppId(name);
    if (!found) return null;

    const details: SteamDetails = {
      appId: found.id,
      link: `https://store.steampowered.com/app/${found.id}`,
      metascore: found.metascore,
    };

    // IStoreBrowseService : remplace /appreviews (qui redirige désormais vers l'accueil)
    const input = {
      ids: [{ appid: found.id }],
      context: { language: 'english', country_code: 'US' },
      data_request: { include_reviews: true, include_release: true },
    };
    const data = await getWithRetry<any>('https://api.steampowered.com/IStoreBrowseService/GetItems/v1/', {
      input_json: JSON.stringify(input),
    });
    const item = data?.response?.store_items?.[0];
    const summary = item?.reviews?.summary_filtered;
    if (summary?.review_count >= MIN_REVIEWS) {
      details.percentPositive = summary.percent_positive;
      details.reviewCount = summary.review_count;
      details.reviewLabel = summary.review_score_label;
    }
    const ts = item?.release?.steam_release_date;
    if (typeof ts === 'number') {
      details.releaseDate = new Date(ts * 1000).toISOString().slice(0, 10);
    }

    // Pas de metascore dans la recherche ? Tenter appdetails.
    if (details.metascore === undefined) {
      const d = await getWithRetry<any>('https://store.steampowered.com/api/appdetails', {
        appids: found.id,
        filters: 'metacritic',
      });
      const score = d?.[found.id]?.data?.metacritic?.score;
      if (typeof score === 'number') details.metascore = score;
    }

    return details;
  }

  async getRating(name: string): Promise<number | null> {
    const d = await this.getDetails(name);
    return d?.metascore ?? d?.percentPositive ?? null;
  }

  async getSteamLink(name: string): Promise<string | null> {
    return (await this.getDetails(name))?.link ?? null;
  }

  async getReleaseDate(name: string): Promise<string | null> {
    return (await this.getDetails(name))?.releaseDate ?? null;
  }
}
