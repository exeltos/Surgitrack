import {useState} from 'react';
import {CheckCircle2, MessageSquareHeart, X} from 'lucide-react';
import StarRating from './StarRating';

type Props = {
  L: (el: string, en: string) => string;
  /** The step just done; none when every step is done and the final evaluation is next. */
  step?: {title: string};
  onRate: (rating: number, comment?: string) => void;
  onLater: () => void;
  onFinal: () => void;
};

/**
 * The card that appears as soon as a guide step is done: "How did you find it?" with 1–5 stars and
 * an optional comment. It never covers the screen; "Later" leaves the rating in the guide. After the
 * last step it asks for the final evaluation instead.
 */
export default function StepRatingCard({L, step, onRate, onLater, onFinal}: Props) {
  const [rating, setRating] = useState<number>();
  const [comment, setComment] = useState('');
  if (!step)
    return (
      <aside className="step-rating-card" aria-label={L('Τελική αξιολόγηση', 'Final evaluation')}>
        <header>
          <CheckCircle2 size={18} />
          <strong>{L('Ολοκληρώσατε όλα τα βήματα!', 'You have done every step!')}</strong>
          <button type="button" onClick={onLater} aria-label={L('Κλείσιμο', 'Close')}>
            <X size={15} />
          </button>
        </header>
        <p>
          {L('Πείτε μας τη συνολική γνώμη σας για το SurgiTrack.', 'Tell us what you think of SurgiTrack overall.')}
        </p>
        <footer>
          <button type="button" onClick={onLater}>
            {L('Αργότερα', 'Later')}
          </button>
          <button type="button" className="primary" onClick={onFinal}>
            <MessageSquareHeart size={15} />
            {L('Κάντε την τελική αξιολόγηση', 'Give your final evaluation')}
          </button>
        </footer>
      </aside>
    );
  return (
    <aside className="step-rating-card" aria-label={L('Αξιολόγηση βήματος', 'Rate this step')}>
      <header>
        <CheckCircle2 size={18} />
        <strong>{L(`Ολοκληρώσατε: ${step.title}`, `Done: ${step.title}`)}</strong>
        <button type="button" onClick={onLater} aria-label={L('Κλείσιμο', 'Close')}>
          <X size={15} />
        </button>
      </header>
      <p>{L('Πώς σας φάνηκε;', 'How did you find it?')}</p>
      <StarRating label={step.title} value={rating} onChange={setRating} />
      {rating !== undefined && (
        <textarea
          rows={2}
          maxLength={2000}
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder={L('Κάτι που θα αλλάζατε; (προαιρετικό)', 'Anything you would change? (optional)')}
          aria-label={L('Σχόλιο', 'Comment')}
        />
      )}
      <footer>
        <button type="button" onClick={onLater}>
          {L('Αργότερα', 'Later')}
        </button>
        <button
          type="button"
          className="primary"
          disabled={rating === undefined}
          onClick={() => rating !== undefined && onRate(rating, comment.trim() || undefined)}
        >
          {L('Αποστολή', 'Send')}
        </button>
      </footer>
    </aside>
  );
}
