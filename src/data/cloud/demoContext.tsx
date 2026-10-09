import {createContext, useContext} from 'react';

/** The open hospital when it is a prospect's evaluation Demo (null otherwise). */
export type EvaluationDemo = {organizationId: string; hospitalName: string; endsAt?: string};

export const EvaluationDemoContext = createContext<EvaluationDemo | null>(null);
export const useEvaluationDemo = () => useContext(EvaluationDemoContext);
