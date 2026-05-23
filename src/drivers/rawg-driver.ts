import axios from 'axios';
import { ApiDriver } from '../types/game';

export class RawgDriver implements ApiDriver {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.rawg.io/api/v1';
  }

  async getRating(name: string): Promise<number | undefined> {
    try {
      const response = await axios.get(`${this.baseUrl}/games`, {
        params: {
          key: this.apiKey,
          search: name,
          page_size: 1,
        },
        timeout: 10000,
      });

      const game = response.data.results[0];
      if (game && game.rating) {
        return Math.round(game.rating * 10); // Convertir de 0-10 à 0-100
      }

      return undefined;
    } catch (error) {
      console.error(`Erreur RAWG pour ${name}:`, error);
      return undefined;
    }
  }

  async getSteamLink(name: string): Promise<string | undefined> {
    try {
      const response = await axios.get(`${this.baseUrl}/games`, {
        params: {
          key: this.apiKey,
          search: name,
          page_size: 1,
        },
        timeout: 10000,
      });

      const game = response.data.results[0];
      if (game && game.stores) {
        const steamStore = game.stores.find((store: any) => 
          store.store.name.toLowerCase().includes('steam')
        );
        if (steamStore) {
          return `https://store.steampowered.com/app/${steamStore.store_id}`;
        }
      }

      return undefined;
    } catch (error) {
      console.error(`Erreur RAWG Steam pour ${name}:`, error);
      return undefined;
    }
  }

  async getReleaseDate(name: string): Promise<string | undefined> {
    try {
      const response = await axios.get(`${this.baseUrl}/games`, {
        params: {
          key: this.apiKey,
          search: name,
          page_size: 1,
        },
        timeout: 10000,
      });

      const game = response.data.results[0];
      if (game && game.released) {
        return game.released;
      }

      return undefined;
    } catch (error) {
      console.error(`Erreur RAWG date pour ${name}:`, error);
      return undefined;
    }
  }
}

