import { lazy, Suspense } from 'react';
import App from './App.tsx';

const Test3DBlade = lazy(() => import('./screens/Test3DBlade.tsx'));
const LeafStemCalibration = lazy(() => import('./screens/LeafStemCalibration.tsx'));
const StudyTablePreview = lazy(() => import('./screens/StudyTablePreview.tsx'));

export default function RootRoute() {
  const path = window.location.pathname.replace(/\/$/, '');
  if (path === '/test-3d-blade') {
    return <Suspense fallback={<div className="min-h-screen bg-[#1A0E2E]" />}><Test3DBlade /></Suspense>;
  }
  if (path === '/leaf-stem-calibration') {
    return <Suspense fallback={<div className="min-h-screen bg-[#1A0E2E]" />}><LeafStemCalibration /></Suspense>;
  }
  if (path === '/study-table-preview') {
    return <Suspense fallback={<div className="min-h-screen bg-[#1A0E2E]" />}><StudyTablePreview /></Suspense>;
  }
  return <App />;
}
