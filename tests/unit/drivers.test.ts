import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RawgDriver } from '@/drivers/rawg-driver';
import { IgdbDriver } from '@/drivers/igdb-driver';
import { OpenCriticDriver } from '@/drivers/opencritic-driver';
import axios from 'axios';

// Mock axios
vi.mocked(axios.get).mockResolvedValue({
  data: {
    results: [
      {
        rating: 8.5,
        stores: [
          { store: { name: 'Steam' }, store_id: '12345' }
        ],
        released: '2024-01-15'
      }
    ]
  }
} as any);

vi.mocked(axios.post).mockResolvedValue({
  data: [
    {
      rating: 85,
      external_games: [
        { category: 1, uid: '67890' }
      ],
      first_release_date: 1705276800
    }
  ]
} as any);

describe('RawgDriver', () => {
  let driver: RawgDriver;

  beforeEach(() => {
    driver = new RawgDriver('test-api-key');
    vi.clearAllMocks();
  });

  it('devrait récupérer une note correctement', async () => {
    const rating = await driver.getRating('Test Game');
    expect(rating).toBe(85);
  });

  it('devrait récupérer un lien Steam correctement', async () => {
    const steamLink = await driver.getSteamLink('Test Game');
    expect(steamLink).toBe('https://store.steampowered.com/app/12345');
  });

  it('devrait récupérer une date de sortie correctement', async () => {
    const releaseDate = await driver.getReleaseDate('Test Game');
    expect(releaseDate).toBe('2024-01-15');
  });

  it('devrait gérer les erreurs gracieusement', async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(new Error('API Error'));
    const rating = await driver.getRating('Test Game');
    expect(rating).toBeUndefined();
  });
});

describe('IgdbDriver', () => {
  let driver: IgdbDriver;

  beforeEach(() => {
    driver = new IgdbDriver('test-client-id', 'test-client-secret');
    vi.clearAllMocks();
  });

  it('devrait récupérer une note correctement', async () => {
    const rating = await driver.getRating('Test Game');
    expect(rating).toBe(85);
  });

  it('devrait récupérer un lien Steam correctement', async () => {
    const steamLink = await driver.getSteamLink('Test Game');
    expect(steamLink).toBe('https://store.steampowered.com/app/67890');
  });

  it('devrait récupérer une date de sortie correctement', async () => {
    const releaseDate = await driver.getReleaseDate('Test Game');
    expect(releaseDate).toBe('2024-01-15');
  });
});

describe('OpenCriticDriver', () => {
  let driver: OpenCriticDriver;

  beforeEach(() => {
    driver = new OpenCriticDriver('test-api-key');
    vi.clearAllMocks();
  });

  it('devrait convertir les tiers en scores correctement', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: [{ tier: 'Mighty' }]
    } as any);

    const rating = await driver.getRating('Test Game');
    expect(rating).toBe(95);
  });

  it('devrait gérer les tiers inconnus', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: [{ tier: 'Unknown' }]
    } as any);

    const rating = await driver.getRating('Test Game');
    expect(rating).toBeUndefined();
  });
});
