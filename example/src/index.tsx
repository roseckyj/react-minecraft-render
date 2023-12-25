import ReactDOM from "react-dom/client";
import { MinecraftViewer } from "react-minecraft-viewer";

const root = ReactDOM.createRoot(
    document.getElementById("root") as HTMLElement
);

root.render(
    <div style={{ position: "fixed", inset: 0 }}>
        <MinecraftViewer
            backgroundColor={[0.1, 0.1, 0.11]}
            regionPath="region/r.0.0.mca"
            chunks={[
                [0, 0],
                [1, 0],
                [0, 1],
                [1, 1],
            ]}
        />
    </div>
);
