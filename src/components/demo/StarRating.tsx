import {Star} from 'lucide-react';

/** 1–5 stars; pressing one sets the rating. */
export default function StarRating({
  value,
  onChange,
  label,
  disabled,
}: {
  value?: number | null;
  onChange: (rating: number) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <span className="star-rating" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n}/5`}
          disabled={disabled}
          className={value && n <= value ? 'on' : ''}
          onClick={() => onChange(n)}
        >
          <Star size={17} />
        </button>
      ))}
    </span>
  );
}
