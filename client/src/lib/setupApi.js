export async function getSetupStatus() {
  const res = await fetch('/api/setup/status');
  if (!res.ok) throw new Error(`getSetupStatus failed: ${res.status}`);
  return res.json();
}

export async function browse({ path, mode }) {
  const params = new URLSearchParams();
  if (path) params.set('path', path);
  params.set('mode', mode);
  const res = await fetch(`/api/setup/browse?${params.toString()}`);
  if (!res.ok) {
    if (res.status === 403) {
      const body = await res.json().catch(() => ({}));
      const err = new Error('path_out_of_bounds');
      err.code = 'PATH_OUT_OF_BOUNDS';
      err.detail = body;
      throw err;
    }
    throw new Error(`browse failed: ${res.status}`);
  }
  return res.json();
}

export async function scanVault(vaultPath) {
  const res = await fetch('/api/setup/scan-vault', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: vaultPath }),
  });
  if (!res.ok) {
    if (res.status === 403) {
      const err = new Error('path_out_of_bounds');
      err.code = 'PATH_OUT_OF_BOUNDS';
      throw err;
    }
    throw new Error(`scanVault failed: ${res.status}`);
  }
  return res.json();
}

export async function saveSources(sources) {
  const res = await fetch('/api/setup/save-sources', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sources }),
  });
  if (!res.ok) {
    if (res.status === 400) {
      const body = await res.json().catch(() => ({}));
      const err = new Error('validation failed');
      err.code = 'VALIDATION_ERROR';
      err.errors = body.errors || [];
      throw err;
    }
    throw new Error(`saveSources failed: ${res.status}`);
  }
  return res.json();
}
