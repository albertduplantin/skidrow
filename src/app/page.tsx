import { MonthlyGames, MonthlyGamesSchema } from '@/types/game';
import { notFound } from 'next/navigation';

// Fonction pour récupérer les données du mois actuel
async function getCurrentMonthData(): Promise<MonthlyGames | null> {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7); // Format YYYY-MM
    const data = await import(`../../public/data/${currentMonth}.json`);
    
    // Valider les données avec Zod
    const validatedData = MonthlyGamesSchema.parse(data.default);
    return validatedData;
  } catch (error) {
    console.error('Erreur lors de la récupération des données:', error);
    return null;
  }
}

// Fonction pour récupérer les données du mois précédent
async function getLastMonthData(): Promise<MonthlyGames | null> {
  try {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStr = lastMonth.toISOString().slice(0, 7); // Format YYYY-MM
    
    const data = await import(`../../public/data/${lastMonthStr}.json`);
    
    // Valider les données avec Zod
    const validatedData = MonthlyGamesSchema.parse(data.default);
    return validatedData;
  } catch (error) {
    console.error('Erreur lors de la récupération des données du mois précédent:', error);
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
      
      <div className="space-y-2 text-sm text-gray-600">
        {game.releaseDate && (
          <div>
            <span className="font-medium">Date de sortie:</span> {new Date(game.releaseDate).toLocaleDateString('fr-FR')}
          </div>
        )}
        
        <div className="flex space-x-4">
          <a
            href={game.skidrowUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            🔗 Skidrow
          </a>
          
          {game.steamLink && (
            <a
              href={game.steamLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 hover:text-green-800 underline"
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
  // Essayer de récupérer les données du mois actuel, sinon du mois précédent
  let data = await getCurrentMonthData();
  let monthLabel = 'ce mois';
  
  if (!data) {
    data = await getLastMonthData();
    monthLabel = 'le mois dernier';
  }

  if (!data) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Jeux de qualité de {monthLabel}
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

      <div className="text-center text-sm text-gray-500">
        <p>
          Données mises à jour le {new Date(data.lastUpdated).toLocaleDateString('fr-FR')} à{' '}
          {new Date(data.lastUpdated).toLocaleTimeString('fr-FR')}
        </p>
      </div>
    </div>
  );
}
