import { lazy, Suspense } from 'react';
import App from './App.tsx';

const Test3DBlade = lazy(() => import('./screens/Test3DBlade.tsx'));

export default function RootRoute() {
  const isBladeTestRoute = window.location.pathname.replace(/\/$/, '') === '/test-3d-blade';
  return isBladeTestRoute
    ? <Suspense fallback={<div className="min-h-screen bg-[#090b09]" />}><Test3DBlade /></Suspense>
    : <App />;
}
