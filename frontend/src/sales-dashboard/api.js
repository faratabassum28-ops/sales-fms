import { useEffect, useState } from "react";
import { api as main } from "../api.js";

// Same helpers as the standalone dashboard, but every call goes through the website's signed-in request layer.
export const api = (path, params) => main.sd(path, params);

// keeps showing the previous data while a new filter selection loads
export function useApi(path, params) {
  const key = JSON.stringify([path, params]);
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ data: s.data, loading: true, error: null }));
    api(path, params)
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => alive && setState((s) => ({ data: s.data, loading: false, error })));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}
