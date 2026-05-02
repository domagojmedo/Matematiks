import { Route, Routes } from "react-router-dom";
import { Home } from "./routes/Home";
import { NotFound } from "./routes/NotFound";
import { Practice } from "./routes/Practice";
import { Sessions } from "./routes/Sessions";
import { SettingsRoute } from "./routes/Settings";
import { Setup } from "./routes/Setup";
import { Summary } from "./routes/Summary";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/setup/:operation" element={<Setup />} />
      <Route path="/practice/:operation" element={<Practice />} />
      <Route path="/summary" element={<Summary />} />
      <Route path="/sessions" element={<Sessions />} />
      <Route path="/settings" element={<SettingsRoute />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
