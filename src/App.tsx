import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { trackPageView } from "./lib/analytics";
import { Grade } from "./routes/Grade";
import { Home } from "./routes/Home";
import { NotFound } from "./routes/NotFound";
import { Practice } from "./routes/Practice";
import { Sessions } from "./routes/Sessions";
import { SettingsRoute } from "./routes/Settings";
import { Setup } from "./routes/Setup";
import { Summary } from "./routes/Summary";

function PageViewTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);
  return null;
}

function App() {
  return (
    <>
      <PageViewTracker />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/setup/:operation" element={<Setup />} />
        <Route path="/grade/:grade" element={<Grade />} />
        <Route path="/practice/:operation" element={<Practice />} />
        <Route path="/summary" element={<Summary />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/settings" element={<SettingsRoute />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default App;
