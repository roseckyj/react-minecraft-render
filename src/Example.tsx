import { useEffect, useMemo, useState } from "react";
import { MinecraftViewer } from "./lib";

export function Example() {
    const [reload, setReload] = useState(0);

    const chunks = useMemo(() => {
        const chunks: [number, number][] = [[16, 16]];
        for (let x = 14; x <= 17; x++) {
            for (let z = 14; z <= 17; z++) {
                if (x === 16 && z === 16) {
                    continue; // The first chunk is considered the center chunk
                }

                chunks.push([x, z]);
            }
        }
        return chunks;
    }, []);

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
                regionPath="/roseckyj/react-minecraft-render/region/spilas.mca"
                assetsPath="/roseckyj/react-minecraft-render/assets.zip"
                chunks={chunks}
                onError={(error) => console.error(error)}
            />
        </>
    );
}
