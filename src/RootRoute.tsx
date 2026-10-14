import { lazy, Suspense } from 'react';
import App from './App.tsx';

const LeafStemCalibration = lazy(() => import('./screens/LeafStemCalibration.tsx'));
const StudyTablePreview = lazy(() => import('./screens/StudyTablePreview.tsx'));

export default function RootRoute() {
  const path = window.location.pathname.replace(/\/$/, '');
  if (path === '/leaf-stem-calibration') {
    return <Suspense fallback={<div className="min-h-screen bg-[#090b09]" />}><LeafStemCalibration /></Suspense>;
  }
  if (path === '/study-table-preview') {
    return <Suspense fallback={<div className="min-h-screen bg-[#090b0a]" />}><StudyTablePreview /></Suspense>;
  }
  return <App />;
}
