import { useState } from 'react';
import { useButton } from '../../core/hooks';
import { wii } from '../../core/wii';
import { Pill } from '../components/Pill';
import { AboutPage, RemotePage, SettingsPage } from './OptionsPages';

type Page = 'menu' | 'remote' | 'settings' | 'about';
const TITLES: Record<Page, string> = { menu: '', remote: 'Wii Remote', settings: 'Settings', about: 'About freeWii' };

/** Opened with the round "Wii" button: remote pairing, settings and credits. */
export function OptionsPanel() {
  const [page, setPage] = useState<Page>('menu');
  const back = () => {
    if (page === 'menu') wii.openPanel('none');
    else setPage('menu');
  };
  useButton('b', back);

  return (
    <div className="panel">
      <div className="panel-head">
        Wii Options {page !== 'menu' && <small>› {TITLES[page]}</small>}
      </div>
      <div className="panel-body">
        {page === 'menu' && (
          <div className="panel-menu">
            <Pill wide onClick={() => setPage('remote')}>
              Wii Remote
            </Pill>
            <Pill wide onClick={() => setPage('settings')}>
              Settings
            </Pill>
            <Pill wide onClick={() => setPage('about')}>
              About freeWii
            </Pill>
          </div>
        )}
        {page === 'remote' && <RemotePage />}
        {page === 'settings' && <SettingsPage />}
        {page === 'about' && <AboutPage />}
      </div>
      <div className="panel-foot">
        <Pill onClick={back} clickSound="back">
          Back
        </Pill>
      </div>
    </div>
  );
}
