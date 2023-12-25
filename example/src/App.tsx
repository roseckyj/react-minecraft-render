import { MinecraftViewer } from "react-minecraft-viewer";

export function App() {
    return (
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
    );
}
