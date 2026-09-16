import React, { Component, lazy, Suspense, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, Link } from "react-router-dom";
import "@fontsource-variable/inter";
import "@digdir/designsystemet-css";
import "./design/digilist/platform-base.css";
import "./design/digilist/digilist-theme.css";
import "./design/digilist/input-overrides.css";
import "./design/digilist/touch-targets.css";
import "./styles.css";
import { AppProvider, useApp } from "./context";
import { Shell } from "./components/Shell";
import { Empty, ErrorState, Loading } from "./components/ui";
import { Rooms } from "./pages/Rooms";
import { RoomDetail } from "./pages/RoomDetail";
import { Login } from "./pages/Login";
import { Checkout } from "./pages/Checkout";
import { MyBookings, BookingDetail } from "./pages/MyBookings";
const Admin = lazy(() =>
  import("./pages/Admin").then((module) => ({ default: module.Admin })),
);
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="container" role="alert">
        <h1>Vi klarte ikke å vise siden</h1>
        <p>
          Last siden på nytt. Eventuelle bookinger finner du i Mine bookinger.
        </p>
        <a className="ds-button" href="/mine-bookinger">
          Åpne Mine bookinger
        </a>
      </div>
    ) : (
      this.props.children
    );
  }
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
        <Route path="rom/:id" element={<RoomDetail />} />
        <Route path="login" element={<Login />} />
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
        <Route
          path="*"
          element={
            <Empty title="Siden finnes ikke">
              <Link to="/">Til romoversikten</Link>
            </Empty>
          }
        />
      </Route>
    </Routes>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <App />
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
