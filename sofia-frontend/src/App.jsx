/**
 * App — top-level screen router for the new white-theme Sofia UI.
 *
 * landing → cv flow        (full progressive, white, center-aligned)
 *         → recruiter page (existing RecruiterApp wrapped in white header)
 *         → plan page      (existing PlanApp wrapped in white header)
 */
import { useState } from "react";
import LandingPage from "./LandingPage.jsx";
import CVFlow from "./CVFlow.jsx";
import RecruiterApp from "./RecruiterApp.jsx";
import PlanApp from "./PlanApp.jsx";

const BACKEND = "http://localhost:5000";


export default function App() {
  const [screen, setScreen] = useState("landing");

  function go(s) { setScreen(s); }
  function home() { setScreen("landing"); }

  if (screen === "cv") {
    return <CVFlow backendUrl={BACKEND} onBack={home} />;
  }

  if (screen === "recruiter") {
    return <RecruiterApp backendUrl={BACKEND} onBack={home} />;
  }

  if (screen === "plan") {
    return <PlanApp backendUrl={BACKEND} onBack={home} />;
  }

  return <LandingPage onSelect={go} />;
}
