import { Navigate, useParams, useSearchParams } from "react-router-dom";
export function Checkout() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const next = new URLSearchParams(params);
  if (id) next.set("rom", id);
  if (next.get("date") && next.get("rom")) next.set("steg", "2");
  return <Navigate replace to={`/ny-booking?${next}`} />;
}
