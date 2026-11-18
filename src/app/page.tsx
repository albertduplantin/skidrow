import { MonthlyGames, MonthlyGamesSchema } from '@/types/game';
import { notFound } from 'next/navigation';
import fs from 'fs';
import path from 'path';
import RefreshButton from './RefreshButton';

async function getMostRecentData(): Promise<MonthlyGames | null> {
  try {
    const dataDir = path.join(process.cwd(), 'public/data');
    const files = fs.readdirSync(dataDir)
      .filter(f => /^\d{4}-\d{2}\.json$/.test(f))
      .sort()
      .reverse();

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(dataDir, file), 'utf-8');
        return MonthlyGamesSchema.parse(JSON.parse(content));
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Composant pour afficher un jeu
function GameCard({ game }: { game: MonthlyGames['games'][0] }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex-1">
          {game.name}
        </h3>
        {game.rating && (
          <div className="ml-4">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              game.rating >= 90 ? 'bg-green-100 text-green-800' :
              game.rating >= 80 ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {game.rating}/100
            </span>
          </div>
        )}
      </div>
      
      <div className="space-y-3 text-sm text-gray-600">
        {game.releaseDate && (
          <div>
            <span className="font-medium">Date de sortie:</span> {new Date(game.releaseDate).toLocaleDateString('fr-FR')}
          </div>
        )}

        <details className="group rounded border border-gray-200 bg-gray-50 px-3 py-2">
          <summary className="cursor-pointer font-medium text-gray-800 select-none">
            📊 Voir les notes
          </summary>
          <ul className="mt-2 space-y-1">
            {game.steamPercent !== undefined && (
              <li>
                Steam : <strong>{game.steamPercent}%</strong> d&apos;avis positifs
                {game.steamReviewLabel && <> ({game.steamReviewLabel}</>}
                {game.steamReviewCount !== undefined && <>, {game.steamReviewCount.toLocaleString('fr-FR')} avis</>}
                {game.steamReviewLabel && <>)</>}
              </li>
            )}
            {game.metacriticScore !== undefined && (
              <li>Metacritic : <strong>{game.metacriticScore}/100</strong></li>
            )}
            {game.openCriticScore !== undefined && (
              <li>OpenCritic : <strong>{game.openCriticScore}/100</strong></li>
            )}
            <li>Note retenue (moyenne des sources) : <strong>{game.rating}/100</strong></li>
          </ul>
          {game.steamLink && (
            <a
              href={game.steamLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-green-700 hover:text-green-900 underline"
            >
              Ouvrir la page Steam ↗
            </a>
          )}
        </details>

        <div className="flex flex-wrap gap-3">
          <a
            href={game.skidrowUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700"
          >
            ⬇️ Page de téléchargement
          </a>
          {game.steamLink && (
            <a
              href={game.steamLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded border border-green-600 px-3 py-1.5 text-green-700 hover:bg-green-50"
            >
              🎮 Steam
            </a>
          )}
        </div>
      </div>
      
      <div className="mt-4 text-xs text-gray-400">
        Mis à jour: {new Date(game.lastUpdated).toLocaleDateString('fr-FR')}
      </div>
    </div>
  );
}

// Composant pour afficher les statistiques
function StatsSection({ data }: { data: MonthlyGames }) {
  const avgRating = data.games.length > 0 
    ? Math.round(data.games.reduce((sum, game) => sum + (game.rating || 0), 0) / data.games.length)
    : 0;
    
  const gamesWithSteam = data.games.filter(game => game.steamLink).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-2xl font-bold text-blue-600">{data.totalCount}</div>
        <div className="text-sm text-gray-600">Total des jeux</div>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-2xl font-bold text-green-600">{avgRating}/100</div>
        <div className="text-sm text-gray-600">Note moyenne</div>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-2xl font-bold text-purple-600">{gamesWithSteam}</div>
        <div className="text-sm text-gray-600">Avec lien Steam</div>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-2xl font-bold text-orange-600">{data.month}</div>
        <div className="text-sm text-gray-600">Mois</div>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const data = await getMostRecentData();

  if (!data) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Meilleurs jeux récents
        </h2>
        <p className="text-lg text-gray-600">
                     Découvrez les meilleurs jeux avec une note d&apos;au moins 80/100
        </p>
      </div>

      <StatsSection data={data} />

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Liste des jeux ({data.games.length})
          </h3>
        </div>
        
        {data.games.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500">Aucun jeu trouvé pour ce mois.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {data.games.map((game, index) => (
              <div key={index} className="px-6 py-4">
                <GameCard game={game} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-center text-sm text-gray-500 space-y-3">
        <p>
          Données mises à jour le {new Date(data.lastUpdated).toLocaleDateString('fr-FR')} à{' '}
          {new Date(data.lastUpdated).toLocaleTimeString('fr-FR')}
        </p>
        <RefreshButton />
      </div>
    </div>
  );
}
