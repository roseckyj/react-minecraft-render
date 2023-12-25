import ReactDOM from "react-dom/client";
import { Example } from "./Example";

const root = ReactDOM.createRoot(
    document.getElementById("root") as HTMLElement
);

root.render(
    <div style={{ position: "fixed", inset: 0 }}>
        <Example />
    </div>
);
