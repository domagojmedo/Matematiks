import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { ProfilesProvider } from "./contexts/ProfilesContext.tsx";
import { SettingsProvider } from "./contexts/SettingsContext.tsx";
import "./i18n";
import "./index.css";

const basename = import.meta.env.BASE_URL.replace(/\/$/, "");

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <SettingsProvider>
        <ProfilesProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </ProfilesProvider>
      </SettingsProvider>
    </BrowserRouter>
  </StrictMode>,
);
