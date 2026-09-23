import { useButton, useRemotes } from '../../core/hooks';
import { wii } from '../../core/wii';
import { Pill } from '../components/Pill';

/** The HOME Menu overlay shown on top of a running channel. */
export function HomeMenu() {
  const remotes = useRemotes();
  useButton('b', () => wii.toggleHomeMenu(false));

  return (
    <div className="home">
      <div className="home-top">
        <Pill small onClick={() => wii.toggleHomeMenu(false)} clickSound="back">
          Close
        </Pill>
        <div className="home-title">HOME Menu</div>
      </div>
      <div className="home-center">
        <Pill wide onClick={() => wii.exitChannel()} clickSound={null}>
          Wii Menu
        </Pill>
        <Pill wide onClick={() => window.location.reload()}>
          Reset
        </Pill>
      </div>
      <div className="home-bottom">
        {remotes.map((r) => (
          <div key={r.id} className="home-remote">
            <span>P{r.player}</span>
            <span className="leds">
              {[1, 2, 3, 4].map((i) => (
                <i key={i} className={`led ${i === r.player ? 'led--on' : ''}`} />
              ))}
            </span>
            <span>{r.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
