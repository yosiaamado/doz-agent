import { createContext, useContext } from 'react';

// The data read by the nodes & edges on the canvas: agents, the workflow meta, the active run, and the approve/edit actions.
export const StudioContext = createContext(null);

export const useStudio = () => useContext(StudioContext);
