import {programsOf} from '../../../core/sterilizerPrograms';
import {tr} from '../../../i18n';

/**
 * The program of a sterilizer load, picked from the sterilizer's own programs (Libraries › Sterilizers). A program
 * that came from elsewhere (a connected device's cycle) stays offered as it is.
 */
export default function ProgramSelect({
  sterilizer,
  value,
  onChange,
  className,
}: {
  className?: string;
  sterilizer?: {el: string; programs?: string[]};
  value: string;
  onChange: (value: string) => void;
}) {
  const programs = programsOf(sterilizer);
  return (
    <label className={className}>
      {tr('Πρόγραμμα')}
      <select value={value} onChange={e => onChange(e.target.value)}>
        {value && !programs.includes(value) && <option value={value}>{value}</option>}
        {programs.map(program => (
          <option key={program} value={program}>
            {program}
          </option>
        ))}
      </select>
    </label>
  );
}
