import { createContext, useContext } from 'react';

// Data yang dibaca node & garis di canvas: agent, meta workflow, run aktif, dan aksi approve/edit.
export const StudioContext = createContext(null);

export const useStudio = () => useContext(StudioContext);
