import {tr} from '../../../i18n';
import {guideStep} from '../../../core/demoGuide';
import {MODULES, moduleOfStep, stepOfTopic} from '../../../core/demoFeedback';
import {tourOrScreenTitle} from '../../../core/demoTours';

/** A rating's subject: a part of the app, or a guide step under its part («Ροή Αποστείρωσης · Παραλαβή»). */
export const moduleTitle = (topic: string) => {
  // A guided tour or a whole screen (evaluation Demo «Ξενάγηση» and «Αξιολογήστε την οθόνη»).
  const tourOrScreen = tourOrScreenTitle(topic, key => guideStep(key)?.title);
  if (tourOrScreen) return tr(tourOrScreen.el);
  const stepKey = stepOfTopic(topic);
  if (stepKey) {
    const step = guideStep(stepKey);
    const part = moduleOfStep(stepKey);
    return [part && tr(part.title.el), step ? tr(step.title.el) : stepKey].filter(Boolean).join(' · ');
  }
  const m = MODULES.find(x => x.key === topic);
  return m ? tr(m.title.el) : topic;
};
export const stars = (n: number) => `${n.toFixed(1).replace('.', ',')} ★`;
