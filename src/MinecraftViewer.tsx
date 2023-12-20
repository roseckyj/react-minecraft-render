import { NbtFile, NbtRegion, Structure, StructureRenderer } from "deepslate";
import { mat4, vec2, vec3 } from "gl-matrix";
import {
    MouseEvent,
    WheelEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { loadStructure } from "./loadStructure";
import { ResourceManager } from "./resources";

export interface IMinecraftChunkProps {
    backgroundColor?: [number, number, number];
    chunks: [number, number][];
    regionPath: string;
    spinner?: JSX.Element | string;
}

const clamp = (a: number, b: number, c: number) => {
    return Math.max(b, Math.min(c, a));
};

const clampVec3 = (a: vec3, b: vec3, c: vec3) => {
    a[0] = clamp(a[0], b[0], c[0]);
    a[1] = clamp(a[1], b[1], c[1]);
    a[2] = clamp(a[2], b[2], c[2]);
};

const negVec3 = (a: vec3) => {
    return vec3.fromValues(-a[0], -a[1], -a[2]);
};

export function MinecraftViewer(props: IMinecraftChunkProps) {
    const [structure, setStructure] = useState<Structure | null>(null);
    const [renderer, setRenderer] = useState<StructureRenderer | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [dragPos, setDragPos] = useState<[number, number] | null>(null);
    const [dragButton, setDragButton] = useState<number>(0);
    const [cRot, setCrot] = useState<[number, number]>([0, 0]);
    const [cPos, setCpos] = useState<[number, number, number]>([0, 0, 0]);
    const [cDist, setCdist] = useState<number>(16);

    const bgColor = useMemo(
        () => props.backgroundColor ?? [0.1, 0.1, 0.11],
        [props.backgroundColor]
    );

    const render = useCallback(() => {
        if (!renderer) return;
        if (!canvasRef.current) return;

        const viewMatrix = mat4.create();
        mat4.translate(viewMatrix, viewMatrix, [0, 0, -cDist]);
        mat4.rotateX(viewMatrix, viewMatrix, cRot[1]);
        mat4.rotateY(viewMatrix, viewMatrix, cRot[0]);
        mat4.translate(viewMatrix, viewMatrix, cPos);

        const context = canvasRef.current.getContext("webgl2")!;

        context.clearColor(bgColor[0], bgColor[1], bgColor[2], 1);
        context.clearDepth(1);
        context.clear(context.COLOR_BUFFER_BIT | context.DEPTH_BUFFER_BIT);
        renderer.drawStructure(viewMatrix);
    }, [bgColor, cDist, cPos, cRot, renderer]);

    const onMouseDown = useCallback((evt: MouseEvent) => {
        setDragPos([evt.clientX, evt.clientY]);
        setDragButton(evt.button);
    }, []);

    const onMouseMove = useCallback(
        (evt: MouseEvent) => {
            if (!structure) return;

            if (dragPos) {
                const dx = (evt.clientX - dragPos[0]) / 500;
                const dy = (evt.clientY - dragPos[1]) / 500;
                if (dragButton === 2) {
                    vec2.add(cRot, cRot, [dx, dy]);
                    setCrot([
                        cRot[0] % (Math.PI * 2),
                        clamp(cRot[1], -Math.PI / 2, Math.PI / 2),
                    ]);
                } else if (dragButton === 0 || dragButton === 1) {
                    vec3.rotateY(cPos, cPos, [0, 0, 0], cRot[0]);
                    vec3.rotateX(cPos, cPos, [0, 0, 0], cRot[1]);
                    const d = vec3.fromValues(dx, -dy, 0);
                    vec3.scale(d, d, 0.25 * cDist);
                    vec3.add(cPos, cPos, d);
                    vec3.rotateX(cPos, cPos, [0, 0, 0], -cRot[1]);
                    vec3.rotateY(cPos, cPos, [0, 0, 0], -cRot[0]);
                    clampVec3(cPos, negVec3(structure.getSize()), [0, 0, 0]);
                    setCpos(cPos);
                } else {
                    return;
                }
                setDragPos([evt.clientX, evt.clientY]);
                render();
            }
        },
        [cDist, cPos, cRot, dragButton, dragPos, render, structure]
    );

    const onMouseUp = useCallback(() => {
        setDragPos(null);
    }, []);

    const onMouseWheel = useCallback(
        (evt: WheelEvent) => {
            let newCDist = cDist + evt.deltaY / 100;
            newCDist = clamp(newCDist, 1, 100);
            setCdist(newCDist);
            render();
        },
        [cDist, render]
    );

    const resize = useCallback(() => {
        if (!renderer) return;
        if (!canvasRef.current) return;

        const bbox = canvasRef.current.getBoundingClientRect();
        canvasRef.current.width = Math.floor(
            bbox.width * window.devicePixelRatio
        );
        canvasRef.current.height = Math.floor(
            bbox.height * window.devicePixelRatio
        );

        renderer.setViewport(
            0,
            0,
            canvasRef.current.width,
            canvasRef.current.height
        );
    }, [renderer]);

    useEffect(() => {
        const resizeAndRender = () => {
            resize();
            render();
        };

        window.addEventListener("resize", resizeAndRender);
        return () => {
            window.removeEventListener("resize", resizeAndRender);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        (async () => {
            if (!canvasRef.current) return;

            const response = await fetch(props.regionPath);
            const buffer = await response.arrayBuffer();

            const structure = loadStructure(
                props.chunks
                    .map((chunk) => {
                        const chunkItem = NbtRegion.read(
                            new Uint8Array(buffer)
                        ).getChunk(chunk[0] + chunk[1] * 32);
                        if (chunkItem === null) return null;
                        return chunkItem?.getFile();
                    })
                    .filter((chunk) => !!chunk) as NbtFile[]
            );

            setStructure(structure);

            const resources = new ResourceManager();
            await Promise.all([
                resources.loadFromZip("/assets.zip"),
                resources.loadBlocks(
                    "https://raw.githubusercontent.com/Arcensoth/mcdata/master/processed/reports/blocks/simplified/data.min.json"
                ),
            ]);

            const renderer = new StructureRenderer(
                canvasRef.current.getContext("webgl2")!,
                structure,
                resources
            );

            setRenderer(renderer);

            setCpos([-8, -structure.getSize()[1] + 16, -8]);
            setCrot([Math.PI / 4, Math.PI / 4]);
            setCdist(32);
        })();
    }, [canvasRef, props.chunks, props.regionPath]);

    useEffect(() => {
        resize();
        render();
    }, [renderer, resize, render]);

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                backgroundColor: `rgb(${bgColor[0] * 255}, ${
                    bgColor[1] * 255
                }, ${bgColor[2] * 255})`,
            }}
        >
            {!renderer &&
                (props.spinner || (
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            width: "100%",
                            height: "100%",
                            opacity: 0.2,
                            fontSize: "1.5em",
                            color: "white",
                        }}
                    >
                        Loading...
                    </div>
                ))}
            <canvas
                style={{ width: "100%", height: "100%" }}
                ref={canvasRef}
                onMouseDown={(e) => onMouseDown(e)}
                onMouseMove={(e) => onMouseMove(e)}
                onMouseUp={() => onMouseUp()}
                onWheel={(e) => onMouseWheel(e)}
                onContextMenu={(e) => e.preventDefault()}
            />
        </div>
    );
}