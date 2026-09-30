import { useCallback, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

// Components (agent/skill/action), the source folders, and the workflow list from the server.
export function useLibrary() {
  const [library, setLibrary] = useState({ agents: [], skills: [], actions: [] });
  const [sources, setSources] = useState(null);
  const [workflows, setWorkflows] = useState([]);

  const reload = useCallback(async () => {
    const [agents, skills, actions, src, wfs] = await Promise.all([
      api.library('agents'), api.library('skills').catch(() => []), api.library('actions').catch(() => []), api.sources(), api.workflows(),
    ]);
    setLibrary({ agents, skills, actions });
    setSources(src);
    setWorkflows(wfs);
    return wfs;
  }, []);

  const reloadWorkflows = useCallback(async () => {
    const wfs = await api.workflows();
    setWorkflows(wfs);
    return wfs;
  }, []);

  const agentsByName = useMemo(
    () => Object.fromEntries(library.agents.filter((a) => !a.shadowed).map((a) => [a.name, a])),
    [library],
  );

  return { library, sources, workflows, agentsByName, reload, reloadWorkflows };
}
