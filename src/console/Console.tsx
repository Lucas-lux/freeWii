import { useEffect, useRef } from 'react';
import { useStore } from '../core/store';
import { bootConsole, consoleStore } from '../core/wii';
import { Cursors } from './components/Cursors';
import { ChannelPreview } from './screens/ChannelPreview';
import { ChannelRunner } from './screens/ChannelRunner';
import { HealthSafety } from './screens/HealthSafety';
import { MessageBoardPanel } from './screens/MessageBoardPanel';
import { OptionsPanel } from './screens/OptionsPanel';
import { WiiMenu } from './screens/WiiMenu';
import '../styles/console.css';
import '../styles/panels.css';

/** The TV: a 16:9 stage hosting every screen of the console. */
export default function Console() {
  const stageRef = useRef<HTMLDivElement>(null);
  const state = useStore(consoleStore);

  useEffect(() => {
    document.title = 'freeWii';
    const stage = stageRef.current;
    if (!stage) return;
    return bootConsole(stage);
  }, []);

  const inMenu = state.screen === 'menu' || state.screen === 'preview';

  return (
    <div className="tv">
      <div className="stage" ref={stageRef}>
        {state.screen === 'boot' && <HealthSafety />}
        {inMenu && <WiiMenu />}
        {state.screen === 'preview' && <ChannelPreview />}
        {state.screen === 'channel' && <ChannelRunner />}
        {state.screen === 'menu' && state.panel === 'options' && <OptionsPanel />}
        {state.screen === 'menu' && state.panel === 'mail' && <MessageBoardPanel />}
        {state.toast && (
          <div className="toast" key={state.toast.id}>
            {state.toast.text}
          </div>
        )}
        <Cursors />
      </div>
    </div>
  );
}
