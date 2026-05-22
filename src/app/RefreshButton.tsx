'use client';

import { useState } from 'react';

export default function RefreshButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function trigger() {
    setStatus('loading');
    setMessage('');
    try {
      const resp = await fetch('/api/trigger-pipeline', { method: 'POST' });
      const data = await resp.json();
      if (data.success) {
        setStatus('success');
        setMessage('Pipeline lancé ! Les données seront mises à jour dans ~5 minutes.');
      } else {
        setStatus('error');
        setMessage(data.error ?? 'Erreur inconnue');
      }
    } catch {
      setStatus('error');
      setMessage('Impossible de contacter le serveur.');
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={trigger}
        disabled={status === 'loading'}
        className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
          status === 'loading'
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : status === 'success'
            ? 'bg-green-600 text-white hover:bg-green-700'
            : status === 'error'
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {status === 'loading' ? '⏳ Lancement en cours…' : '🔄 Mettre à jour les données'}
      </button>
      {message && (
        <p className={`text-sm ${status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
