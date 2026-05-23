import axios from 'axios';
import { ApiDriver } from '../types/game';

export class OpenCriticDriver implements ApiDriver {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://opencritic-api.p.rapidapi.com';
  }

  async getRating(name: string): Promise<number | undefined> {
    try {
      const response = await axios.get(`${this.baseUrl}/game/search`, {
        params: { criteria: name },
        headers: {
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': 'opencritic-api.p.rapidapi.com',
        },
      });

      const game = response.data[0];
      if (game && game.tier) {
        // Convertir le tier en score numérique
        const tierScores: { [key: string]: number } = {
          'Mighty': 95,
          'Strong': 85,
          'Fair': 75,
          'Weak': 65,
          'Skip': 45,
        };
        return tierScores[game.tier] || undefined;
      }

      return undefined;
    } catch (error) {
      console.error(`Erreur OpenCritic pour ${name}:`, error);
      return undefined;
    }
  }

  async getSteamLink(name: string): Promise<string | undefined> {
    try {
      const response = await axios.get(`${this.baseUrl}/game/search`, {
        params: { criteria: name },
        headers: {
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': 'opencritic-api.p.rapidapi.com',
        },
      });

      const game = response.data[0];
      if (game && game.links && game.links.steam) {
        return game.links.steam;
      }

      return undefined;
    } catch (error) {
      console.error(`Erreur OpenCritic Steam pour ${name}:`, error);
      return undefined;
    }
  }

  async getReleaseDate(name: string): Promise<string | undefined> {
    try {
      const response = await axios.get(`${this.baseUrl}/game/search`, {
        params: { criteria: name },
        headers: {
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': 'opencritic-api.p.rapidapi.com',
        },
      });

      const game = response.data[0];
      if (game && game.firstReleaseDate) {
        return game.firstReleaseDate;
      }

      return undefined;
    } catch (error) {
      console.error(`Erreur OpenCritic date pour ${name}:`, error);
      return undefined;
    }
  }
}

