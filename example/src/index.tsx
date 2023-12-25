import ReactDOM from "react-dom/client";
import { App } from "./App";

const root = ReactDOM.createRoot(
    document.getElementById("root") as HTMLElement
);

root.render(
    <div style={{ position: "fixed", inset: 0 }}>
        <App />
    </div>
);
