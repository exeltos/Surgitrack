import {Compass, FlaskConical, ListChecks, Timer} from 'lucide-react';

/**
 * The first screen of an evaluation Demo, once per person and browser: what the Demo is, what to try and
 * how long it lasts, then a guided tour of the first step for their role (or the list of steps).
 */
export default function DemoWelcome({
  L,
  hospitalName,
  days,
  firstStep,
  onTour,
  onSteps,
}: {
  L: (el: string, en: string) => string;
  hospitalName: string;
  days: number;
  firstStep?: string;
  onTour: () => void;
  onSteps: () => void;
}) {
  const cards = [
    {
      icon: <FlaskConical size={20} />,
      title: L('Ένα δικό σας Demo', 'A Demo of your own'),
      text: L(
        `Το «${hospitalName}» έχει δοκιμαστικά Σετ, εργαλεία και τμήματα. Δοκιμάστε ό,τι θέλετε· τίποτα δεν πειράζει κάτι πραγματικό.`,
        `«${hospitalName}» has sample Sets, instruments and departments. Try anything; nothing touches real data.`,
      ),
    },
    {
      icon: <ListChecks size={20} />,
      title: L('Λίγα βήματα, με ξενάγηση', 'A few steps, with a tour'),
      text: L(
        'Κάθε βήμα σας δείχνει πάνω στην οθόνη τι να πατήσετε και ολοκληρώνεται μόλις το κάνετε.',
        'Each step shows you on the screen what to press and completes itself once you do it.',
      ),
    },
    {
      icon: <Timer size={20} />,
      title: L(
        days === 1 ? '1 ημέρα δοκιμής' : `${days} ημέρες δοκιμής`,
        days === 1 ? '1 day to try' : `${days} days to try`,
      ),
      text: L(
        'Μετά από κάθε ενότητα πείτε μας πώς σας φάνηκε, με αστέρια και ένα σχόλιο.',
        'After each part, tell us how you found it, with stars and a comment.',
      ),
    },
  ];
  return (
    <div className="modal-backdrop demo-welcome-backdrop">
      <div className="demo-welcome" role="dialog" aria-modal="true" aria-labelledby="demo-welcome-title">
        <span className="eyebrow">DEMO</span>
        <h2 id="demo-welcome-title">{L('Καλώς ήρθατε στο SurgiTrack', 'Welcome to SurgiTrack')}</h2>
        <div className="demo-welcome-cards">
          {cards.map(card => (
            <div key={card.title} className="demo-welcome-card">
              {card.icon}
              <strong>{card.title}</strong>
              <span>{card.text}</span>
            </div>
          ))}
        </div>
        <div className="modal-actions demo-welcome-actions">
          <button type="button" onClick={onSteps}>
            {L('Δείτε τα βήματα', 'See the steps')}
          </button>
          <button type="button" className="primary" onClick={onTour} autoFocus>
            <Compass size={16} />
            {firstStep
              ? L(`Ξεκινήστε: ${firstStep}`, `Start: ${firstStep}`)
              : L('Ξεκινήστε την ξενάγηση', 'Start the tour')}
          </button>
        </div>
      </div>
    </div>
  );
}
