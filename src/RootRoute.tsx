import { lazy, Suspense } from "react";
import App from "./App.tsx";

const LeafStemCalibration = import.meta.env.DEV
  ? lazy(() => import("./screens/LeafStemCalibration.tsx"))
  : null;
const StudyTablePreview = import.meta.env.DEV
  ? lazy(() => import("./screens/StudyTablePreview.tsx"))
  : null;
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

  if (
    import.meta.env.DEV &&
    path === "/leaf-stem-calibration" &&
    LeafStemCalibration
  ) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#090b09]" />}>
        <LeafStemCalibration />
      </Suspense>
    );
  }
  if (
    import.meta.env.DEV &&
    path === "/study-table-preview" &&
    StudyTablePreview
  ) {
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
