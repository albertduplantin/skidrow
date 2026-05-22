'use client';

import { useState, useEffect, useCallback } from 'react';

type Step = {
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
};

type RunInfo = {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
};

type PipelineStatus = {
  run: RunInfo | null;
  steps: Step[];
};

function stepIcon(step: Step) {
  if (step.status === 'in_progress') return '⏳';
  if (step.status === 'queued') return '⏸️';
  if (step.conclusion === 'success') return '✅';
  if (step.conclusion === 'failure') return '❌';
  if (step.conclusion === 'skipped') return '⊘';
  return '•';
}

function stepColor(step: Step) {
  if (step.status === 'in_progress') return 'text-blue-600 font-semibold';
  if (step.conclusion === 'success') return 'text-green-600';
  if (step.conclusion === 'failure') return 'text-red-600 font-semibold';
  if (step.conclusion === 'skipped') return 'text-gray-400';
  return 'text-gray-500';
}

function duration(step: Step) {
  if (!step.started_at || !step.completed_at) return '';
  const secs = Math.round((new Date(step.completed_at).getTime() - new Date(step.started_at).getTime()) / 1000);
  return ` (${secs}s)`;
}

export default function RefreshButton() {
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState('');
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [polling, setPolling] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/pipeline-status');
      const data: PipelineStatus = await res.json();
      setStatus(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  // Polling quand pipeline en cours
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(async () => {
      const data = await fetchStatus();
      if (data?.run?.status === 'completed') {
        setPolling(false);
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [polling, fetchStatus]);

  async function trigger() {
    setTriggering(true);
    setTriggerMsg('');
    try {
      const res = await fetch('/api/trigger-pipeline', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setTriggerMsg('Pipeline lancé !');
        setPolling(true);
        setTimeout(fetchStatus, 3000);
      } else {
        setTriggerMsg(`Erreur : ${data.error}`);
      }
    } catch {
      setTriggerMsg('Impossible de contacter le serveur.');
    } finally {
      setTriggering(false);
    }
  }

  const run = status?.run;
  const steps = status?.steps ?? [];
  const isRunning = run?.status === 'in_progress' || run?.status === 'queued';

  return (
    <div className="space-y-4 w-full max-w-xl mx-auto">
      {/* Bouton */}
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={trigger}
          disabled={triggering || isRunning}
          className={`px-5 py-2 rounded-lg font-medium text-sm transition-colors ${
            triggering || isRunning
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {triggering ? '⏳ Lancement…' : isRunning ? '🔄 Pipeline en cours…' : '🔄 Mettre à jour les données'}
        </button>
        {triggerMsg && <p className="text-sm text-gray-600">{triggerMsg}</p>}
      </div>

      {/* Panneau de logs */}
      {run && (
        <div className="bg-gray-900 text-gray-100 rounded-lg p-4 text-left text-xs font-mono space-y-1">
          <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-2">
            <span className="text-gray-400 font-sans text-xs">
              Pipeline #{run.id} — {new Date(run.created_at).toLocaleString('fr-FR')}
            </span>
            <span className={`font-bold ${
              run.conclusion === 'success' ? 'text-green-400' :
              run.conclusion === 'failure' ? 'text-red-400' :
              isRunning ? 'text-blue-400' : 'text-gray-400'
            }`}>
              {run.conclusion === 'success' ? '✅ Succès' :
               run.conclusion === 'failure' ? '❌ Échec' :
               isRunning ? '⏳ En cours…' : run.status}
            </span>
          </div>

          {steps.filter(s => s.name !== 'Set up job').map((step, i) => (
            <div key={i} className={`flex gap-2 ${stepColor(step)}`}>
              <span className="w-4 shrink-0">{stepIcon(step)}</span>
              <span>{step.name}{duration(step)}</span>
            </div>
          ))}

          {isRunning && (
            <div className="text-gray-500 text-xs mt-2 animate-pulse">
              Mise à jour toutes les 6 secondes…
            </div>
          )}

          <a
            href={run.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-blue-400 hover:text-blue-300 underline text-xs mt-2"
          >
            Voir les logs complets sur GitHub →
          </a>
        </div>
      )}
    </div>
  );
}
