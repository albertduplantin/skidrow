import axios from 'axios';
import { ApiDriver } from '../types/game';

export class SteamDriver implements ApiDriver {
  private async findAppId(name: string): Promise<number | null> {
    try {
      const resp = await axios.get('https://store.steampowered.com/api/storesearch/', {
        params: { term: name, l: 'english', cc: 'US' },
        timeout: 10000,
      });
      const items: Array<{ id: number; name: string }> = resp.data?.items ?? [];
      if (!items.length) return null;
      // Préférer la correspondance exacte (insensible à la casse)
      const exact = items.find(i => i.name.toLowerCase() === name.toLowerCase());
      return (exact ?? items[0]).id;
    } catch {
      return null;
    }
  }

  async getRating(name: string): Promise<number | null> {
    const appid = await this.findAppId(name);
    if (!appid) return null;

    // 1. Score Metacritic via l'API Steam (pas besoin de clé Metacritic)
    try {
      const resp = await axios.get('https://store.steampowered.com/api/appdetails', {
        params: { appids: appid, filters: 'metacritic' },
        timeout: 10000,
      });
      const score: number | undefined = resp.data?.[appid]?.data?.metacritic?.score;
      if (score) return score;
    } catch { /* continue */ }

    // 2. Score basé sur les avis Steam (% positifs)
    try {
      const resp = await axios.get(
        `https://store.steampowered.com/appreviews/${appid}`,
        {
          params: { json: 1, language: 'all', review_type: 'all', purchase_type: 'all' },
          timeout: 10000,
        }
      );
      const s = resp.data?.query_summary;
      if (s?.total_reviews > 50) {
        return Math.round((s.total_positive / s.total_reviews) * 100);
      }
    } catch { /* continue */ }

    return null;
  }

  async getSteamLink(name: string): Promise<string | null> {
    const appid = await this.findAppId(name);
    return appid ? `https://store.steampowered.com/app/${appid}` : null;
  }

  async getReleaseDate(name: string): Promise<string | null> {
    const appid = await this.findAppId(name);
    if (!appid) return null;
    try {
      const resp = await axios.get('https://store.steampowered.com/api/appdetails', {
        params: { appids: appid, filters: 'release_date' },
        timeout: 10000,
      });
      const dateStr: string | undefined = resp.data?.[appid]?.data?.release_date?.date;
      if (!dateStr) return null;
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    } catch {
      return null;
    }
  }
}
