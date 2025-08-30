import { vi } from 'vitest';

// Mock des modules Node.js
vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock('path', () => ({
  join: (...args: string[]) => args.join('/'),
}));

// Mock d'axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock de cheerio
vi.mock('cheerio', () => ({
  load: vi.fn(() => ({
    find: vi.fn(() => ({
      each: vi.fn(),
      text: vi.fn(() => ''),
      attr: vi.fn(() => ''),
    })),
  })),
}));

// Configuration globale pour les tests
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};
