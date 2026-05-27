import { useState } from 'react';
import { ModePicker } from './ModePicker.jsx';
import { ExistingSourcesList } from './ExistingSourcesList.jsx';
import { FileBrowser } from './FileBrowser.jsx';
import { FolderBrowser } from './FolderBrowser.jsx';
import { ScanProgress } from './ScanProgress.jsx';
import { ChecklistReview } from './ChecklistReview.jsx';
import { ConfirmLoading } from './ConfirmLoading.jsx';
import { scanVault, saveSources } from '../../lib/setupApi.js';

export function OnboardingFlow({ mode, existingSources, onComplete, onRemoveSource }) {
  const [state, setState] = useState('MODE_PICK');
  const [candidates, setCandidates] = useState([]);
  const [scanTargetPath, setScanTargetPath] = useState(null);
  const [error, setError] = useState(null);

  const handlePickFiles = () => setState('BROWSE_FILES');
  const handlePickVault = () => setState('BROWSE_FOLDERS');

  const handleFilesNext = (selectedEntries) => {
    setCandidates(selectedEntries);
    setState('REVIEW');
  };

  const handleScan = async (vaultPath) => {
    setScanTargetPath(vaultPath);
    setState('SCANNING');
    try {
      const result = await scanVault(vaultPath);
      const cands = result.boards.map(b => ({
        fullPath: b.fullPath,
        name: b.relativePath.split('/').pop(),
        inferredVault: b.inferredVault ?? result.vaultName ?? null,
      }));
      setCandidates(cands);
      setState('REVIEW');
    } catch (err) {
      setError(err);
      setState('ERROR');
    }
  };

  const handleConfirm = async (selected) => {
    setState('SAVING');
    try {
      const sources = selected.map((row, idx) => ({
        id: idx === 0 ? 'obsidian' : `obsidian-${idx}`,
        adapter: 'ObsidianAdapter',
        config: { file: row.file, vault: row.vault },
        pollIntervalSec: 60,
      }));
      const merged = mode === 'settings'
        ? [...existingSources.map(s => ({
            id: s.id,
            adapter: s.adapter || 'ObsidianAdapter',
            config: { file: s.file, vault: s.vault },
            pollIntervalSec: 60,
          })), ...sources]
        : sources;
      await saveSources(merged);
      setState('DONE');
      onComplete();
    } catch (err) {
      setError(err);
      setState('ERROR');
    }
  };

  return (
    <div className="min-h-screen p-8">
      {state === 'MODE_PICK' && (
        <>
          {mode === 'settings' && (
            <ExistingSourcesList sources={existingSources} onRemove={onRemoveSource} />
          )}
          <ModePicker onPickFiles={handlePickFiles} onPickVault={handlePickVault} />
        </>
      )}

      {state === 'BROWSE_FILES' && (
        <FileBrowser
          onNext={handleFilesNext}
          onBack={() => setState('MODE_PICK')}
        />
      )}

      {state === 'BROWSE_FOLDERS' && (
        <FolderBrowser
          onScan={handleScan}
          onBack={() => setState('MODE_PICK')}
        />
      )}

      {state === 'SCANNING' && <ScanProgress vaultPath={scanTargetPath} />}

      {state === 'REVIEW' && (
        <ChecklistReview
          candidates={candidates}
          onBack={() => setState('MODE_PICK')}
          onConfirm={handleConfirm}
        />
      )}

      {state === 'SAVING' && <ConfirmLoading />}

      {state === 'ERROR' && (
        <div className="max-w-md mx-auto text-center p-8">
          <p className="text-hud-warn uppercase tracking-widest mb-2">Error</p>
          <p className="text-sm opacity-80">{error?.message}</p>
          <button
            type="button"
            onClick={() => setState('MODE_PICK')}
            className="mt-4 px-3 py-2 border border-hud-accent text-hud-accent text-xs uppercase tracking-widest"
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
}
