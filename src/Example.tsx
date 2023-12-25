import { useEffect, useState } from "react";
import { MinecraftViewer } from "./lib";

export function Example() {
    const [reload, setReload] = useState(0);
    const [chunks, setChunks] = useState<[number, number][]>([[0, 0]]);

    useEffect(() => {
        const interval = setInterval(() => {
            setReload((reload) => reload + 1);
        }, 1000);
        return () => clearInterval(interval);
    });

    return (
        <>
            <MinecraftViewer
                backgroundColor={[0.1, 0.1, 0.11]}
                regionPath="/roseckyj/react-minecraft-render/region/r.0.0.mca"
                assetsPath="/roseckyj/react-minecraft-render/assets.zip"
                chunks={chunks}
            />
            <button
                style={{ position: "fixed", top: 10, left: 10 }}
                onClick={() =>
                    setChunks([
                        [
                            Math.floor(Math.random() * 32),
                            Math.floor(Math.random() * 32),
                        ],
                    ])
                }
            >
                Change chunks
            </button>
        </>
    );
}
