import { Link } from 'react-router-dom';
import { overnightLabel, overnightTone } from '../lib/overnight';
import { useOvernightContext } from '../lib/useOvernightContext';
import { Egg } from './Egg';

/**
 * Whether the newest night holds something this reader has not seen, beside
 * NavAttention rather than inside it - that panel is rows a person has to go
 * and *do*; a night's haul is something to go and *look at*, and folding it
 * in would mean the loop is "waiting on you" every morning after a good night.
 *
 * Quiet and loud occupy the same width (App.css), the loud state carries a
 * digit rather than a dot, and the accessible name says in words what the
 * colour says - the same three decisions NavAttention.tsx made, carried over
 * as written. Never draws nothing: "nothing landed" is an answer worth
 * drawing, and it is the answer most of the time.
 *
 * A plain link, not a dropdown: there is one destination, `/overnight`, and
 * nothing here worth a panel.
 */
export function NavOvernight() {
  const { dto } = useOvernightContext();
  const tone = overnightTone(dto);
  const label = overnightLabel(dto);
  const unseen = dto?.unseen ?? 0;

  return (
    <Link
      to="/overnight"
      className={`hatch-overnight-control hatch-overnight-${tone}`}
      title={label}
      aria-label={label}
    >
      <Egg lit={tone === 'asking'} className="hatch-overnight-glyph" />
      {tone === 'rest' ? (
        <span className="hatch-overnight-word">Quiet</span>
      ) : (
        <span className="hatch-overnight-pill">{unseen}</span>
      )}
    </Link>
  );
}
