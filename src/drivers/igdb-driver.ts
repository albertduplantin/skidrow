import axios from 'axios';
import { ApiDriver } from '../types/game';

export class IgdbDriver implements ApiDriver {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post('https://id.twitch.tv/oauth2/token', {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
      }, { timeout: 10000 });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // Expire 1 min avant

      return this.accessToken!;
    } catch (error) {
      console.error('Erreur lors de l\'obtention du token Twitch:', error);
      throw new Error('Impossible d\'obtenir le token d\'accès Twitch');
    }
  }

  async getRating(name: string): Promise<number | undefined> {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.post('https://api.igdb.com/v4/games',
        `search "${name}"; fields name,rating,rating_count; limit 1;`,
        {
          headers: {
            'Client-ID': this.clientId,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'text/plain',
          },
          timeout: 10000,
        }
      );

      const game = response.data[0];
      if (game && game.rating) {
        return Math.round(game.rating); // IGDB utilise déjà 0-100
      }

      return undefined;
    } catch (error) {
      console.error(`Erreur IGDB pour ${name}:`, error);
      return undefined;
    }
  }

  async getSteamLink(name: string): Promise<string | undefined> {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.post('https://api.igdb.com/v4/games',
        `search "${name}"; fields name,external_games; limit 1;`,
        {
          headers: {
            'Client-ID': this.clientId,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'text/plain',
          },
          timeout: 10000,
        }
      );

      const game = response.data[0];
      if (game && game.external_games) {
        // Récupérer l'ID Steam depuis external_games
        const steamGame = game.external_games.find((ext: any) => ext.category === 1); // 1 = Steam
        if (steamGame) {
          return `https://store.steampowered.com/app/${steamGame.uid}`;
        }
      }

      return undefined;
    } catch (error) {
      console.error(`Erreur IGDB Steam pour ${name}:`, error);
      return undefined;
    }
  }

  async getReleaseDate(name: string): Promise<string | undefined> {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.post('https://api.igdb.com/v4/games',
        `search "${name}"; fields name,first_release_date; limit 1;`,
        {
          headers: {
            'Client-ID': this.clientId,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'text/plain',
          },
          timeout: 10000,
        }
      );

      const game = response.data[0];
      if (game && game.first_release_date) {
        // Convertir le timestamp Unix en date ISO
        return new Date(game.first_release_date * 1000).toISOString().split('T')[0];
      }

      return undefined;
    } catch (error) {
      console.error(`Erreur IGDB date pour ${name}:`, error);
      return undefined;
    }
  }
}
