import React, { Component, lazy, Suspense, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  Link,
  useParams,
  useSearchParams,
} from "react-router-dom";
import "@fontsource-variable/inter";
import "@digdir/designsystemet-css";
import "./design/digilist/platform-base.css";
import "./design/digilist/digilist-theme.css";
import "./design/digilist/input-overrides.css";
import "./design/digilist/touch-targets.css";
import "./styles.css";
import { AppProvider, useApp } from "./context";
import { I18nProvider, useT } from "./i18n";
import { Shell } from "./components/Shell";
import { Empty, ErrorState, Loading } from "./components/ui";
import { Rooms } from "./pages/Rooms";
import { Login } from "./pages/Login";
import { AuthCallback } from "./pages/AuthCallback";
import { Checkout } from "./pages/Checkout";
import { NewBooking } from "./pages/NewBooking";
import { MyBookings, BookingDetail } from "./pages/MyBookings";
import { bookHref } from "./components/RoomCard";
function LegacyRoomRedirect() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  return <Navigate replace to={bookHref(id, params.toString())} />;
}
const Admin = lazy(() =>
  import("./pages/Admin").then((module) => ({ default: module.Admin })),
);
function ErrorBoundaryFallback() {
  const { t } = useT();
  return (
    <div className="container" role="alert">
      <h1>{t("common.page_crash_title")}</h1>
      <p>{t("common.page_crash_body")}</p>
      <a className="ds-button" href="/">
        {t("common.to_room_overview")}
      </a>
    </div>
  );
}
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <ErrorBoundaryFallback /> : this.props.children;
  }
}
function NotFound() {
  const { t } = useT();
  return (
    <Empty title={t("common.page_not_found")}>
      <Link to="/">{t("common.to_room_overview")}</Link>
    </Empty>
  );
}
function App() {
  const { loading, error, refresh } = useApp();
  if (loading) return <Loading />;
  if (error)
    return (
      <div className="container">
        <ErrorState error={error} retry={() => void refresh()} />
      </div>
    );
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Rooms />} />
        <Route path="rom/:id" element={<LegacyRoomRedirect />} />
        <Route path="login" element={<Login />} />
        <Route path="auth/callback" element={<AuthCallback />} />
        <Route path="ny-booking" element={<NewBooking />} />
        <Route path="bestill/:id" element={<Checkout />} />
        <Route path="mine-bookinger" element={<MyBookings />} />
        <Route path="booking/:id" element={<BookingDetail />} />
        <Route
          path="admin/*"
          element={
            <Suspense fallback={<Loading />}>
              <Admin />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <AppProvider>
            <App />
          </AppProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </I18nProvider>
  </React.StrictMode>,
);
