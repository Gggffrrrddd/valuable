import { lazy, Suspense } from "react";
import App from "./App.tsx";

const LeafStemCalibration = lazy(
  () => import("./screens/LeafStemCalibration.tsx"),
);
const StudyTablePreview = lazy(() => import("./screens/StudyTablePreview.tsx"));
const PublicDeleteAccountPage = lazy(
  () => import("./screens/PublicDeleteAccountPage.tsx"),
);

// Snapshot the public deletion intent once. Auth/URL cleanup must never turn
// this route back into the signed-in app after the first render.
const INITIAL_PATH = window.location.pathname.replace(/\/$/, "");
const INITIAL_PUBLIC_DELETE_REQUESTED =
  INITIAL_PATH === "/delete-account" ||
  new URLSearchParams(window.location.search).has("delete-account") ||
  window.location.hash === "#delete-account";

export default function RootRoute() {
  const path = INITIAL_PATH;
  const publicDeleteRequested = INITIAL_PUBLIC_DELETE_REQUESTED;

  if (path === "/leaf-stem-calibration") {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#090b09]" />}>
        <LeafStemCalibration />
      </Suspense>
    );
  }
  if (path === "/study-table-preview") {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#090b0a]" />}>
        <StudyTablePreview />
      </Suspense>
    );
  }
  if (publicDeleteRequested) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#090b0a]" />}>
        <PublicDeleteAccountPage />
      </Suspense>
    );
  }
  return <App />;
}
