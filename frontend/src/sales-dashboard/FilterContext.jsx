import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const Ctx = createContext(null);

export function FilterProvider({ children }) {
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState(null);
  const [filters, setFilters] = useState({ from: '', to: '', programs: [], closers: [] });

  const [rev, setRev] = useState(0);
  useEffect(() => {
    api('/meta').then((m) => { setMeta(m); setMetaError(null); }).catch(setMetaError);
  }, [rev]);

  const value = useMemo(() => ({
    meta,
    metaError,
    filters,
    rev,
    refresh: () => setRev((r) => r + 1),
    setFilters: (patch) => setFilters((f) => ({ ...f, ...patch })),
  }), [meta, metaError, filters, rev]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useFilters = () => useContext(Ctx);
