import { Suspense, lazy } from 'react';

const Console = lazy(() => import('./console/Console'));
const Remote = lazy(() => import('./remote/Remote'));

/** `/remote` is the phone controller, everything else is the console. */
export function App() {
  const isRemote = window.location.pathname.replace(/\/+$/, '') === '/remote';
  return (
    <Suspense fallback={<div className="app-loading">freeWii</div>}>
      {isRemote ? <Remote /> : <Console />}
    </Suspense>
  );
}
