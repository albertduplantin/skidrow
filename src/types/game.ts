import { z } from 'zod';

// Schéma de validation pour un jeu
export const GameSchema = z.object({
  name: z.string(),
  skidrowUrl: z.string().url(),
  releaseDate: z.string().optional(),
  rating: z.number().min(0).max(100).optional(),
  metacriticScore: z.number().min(0).max(100).optional(),
  steamLink: z.string().url().optional(),
  igdbId: z.number().optional(),
  rawgId: z.number().optional(),
  openCriticScore: z.number().min(0).max(100).optional(),
  lastUpdated: z.string(),
});

export type Game = z.infer<typeof GameSchema>;

// Schéma pour la liste des jeux d'un mois
export const MonthlyGamesSchema = z.object({
  month: z.string(),
  games: z.array(GameSchema),
  totalCount: z.number(),
  lastUpdated: z.string(),
});

export type MonthlyGames = z.infer<typeof MonthlyGamesSchema>;

// Interface pour les drivers API
export interface ApiDriver {
  getRating(name: string): Promise<number | undefined>;
  getSteamLink(name: string): Promise<string | undefined>;
  getReleaseDate(name: string): Promise<string | undefined>;
}

// Configuration des APIs
export interface ApiConfig {
  rawg: {
    apiKey: string;
    baseUrl: string;
  };
  twitch: {
    clientId: string;
    clientSecret: string;
    baseUrl: string;
  };
  openCritic: {
    apiKey: string;
    baseUrl: string;
  };
}
