import {
    NbtFile,
    NbtRegion,
    Structure,
    StructureRenderer,
    clamp,
} from "deepslate";
import { mat4, vec2, vec3 } from "gl-matrix";
import { WheelEvent, useCallback, useEffect, useRef, useState } from "react";
import { ResourceManager } from "../data/ResourceManager";
import { structureFromChunkFiles } from "../data/structureFromChunkFiles";
import { clampVec3, negVec3 } from "../utils/math";

export interface IMinecraftChunkProps {
    /** OpenGL background color, array of 3 values between 0 and 1 (default: [0.1, 0.1, 0.11]) */
    backgroundColor?: [number, number, number];
    /** Array of chunk coordinates to render, each entry must be a pair of two numbers (x, y) between 0 and 31 */
    chunks: [number, number][];
    /** Path to the region file to load. May be a local file or a URL. */
    regionPath: string;
    /** Path to the assets.zip file to load. May be a local file or a URL. (default: "/assets.zip") */
    assetsPath?: string;
    /** JSX element to display while loading (default: centered "Loading..." text) */
    spinner?: JSX.Element | string;
    /** Callback for errors that occur during loading */
    onError?: (error: Error) => void;
}

/**
 * JSX Component for rendering a set of chunks from a minecraft Anvil region file.
 * @param props Props for the component.
 * @returns
 */
export function MinecraftViewer(props: IMinecraftChunkProps) {
    const [structure, setStructure] = useState<Structure | null>(null);
    const [renderer, setRenderer] = useState<StructureRenderer | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [dragPos, setDragPos] = useState<[number, number] | null>(null);
    const [cRot, setCrot] = useState<[number, number]>([0, 0]);
    const [cPos, setCpos] = useState<[number, number, number]>([0, 0, 0]);
    const [cDist, setCdist] = useState<number>(16);
    const [touchStartDistance, setTouchStartDistance] = useState<number>(0);
    const [dragButton, setDragButton] = useState<number>(0);

    // Prevent rerendering, when only reference changes
    const [chunks, setChunks] = useState<[number, number][]>(props.chunks);
    const [bgColor, setBgColor] = useState<[number, number, number]>(
        props.backgroundColor || [0.1, 0.1, 0.11]
    );

    useEffect(() => {
        if (JSON.stringify(chunks) === JSON.stringify(props.chunks)) return;

        setChunks(props.chunks);
    }, [props.chunks]);

    useEffect(() => {
        if (JSON.stringify(bgColor) === JSON.stringify(props.backgroundColor))
            return;

        setBgColor(props.backgroundColor ?? [0.1, 0.1, 0.11]);
    }, [props.backgroundColor]);
    // --

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

    type clientXY = {
        clientX: number;
        clientY: number;
        button: number;
        distance?: number;
    };

    const onMouseDown = useCallback((evt: clientXY) => {
        setDragPos([evt.clientX, evt.clientY]);
        setDragButton(evt.button);
    }, []);

    const onMouseMove = useCallback(
        (evt: clientXY) => {
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
            }

            if (touchStartDistance && evt.distance) {
                const newCDist =
                    cDist * (touchStartDistance / evt.distance || 0.001);
                setCdist(newCDist);
                setTouchStartDistance(evt.distance);
            }

            render();
        },
        [cDist, cPos, cRot, dragPos, render, structure]
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
    }, []);

    useEffect(() => {
        setRenderer(null);

        (async () => {
            if (!canvasRef.current) return;
            try {
                const response = await fetch(props.regionPath);
                const buffer = await response.arrayBuffer();

                const structure = structureFromChunkFiles(
                    chunks
                        .map((chunk) => {
                            const chunkItem = NbtRegion.read(
                                new Uint8Array(buffer)
                            ).getChunk(chunk[0] + chunk[1] * 32);
                            if (chunkItem === null) return null;
                            return chunkItem?.getFile();
                        })
                        .filter((chunk) => !!chunk) as NbtFile[]
                );

                if (!structure)
                    props.onError &&
                        props.onError(new Error("Failed to load structure"));
                if (!structure.getSize())
                    props.onError &&
                        props.onError(new Error("Failed to load structure"));
                if (
                    structure.getSize()[0] === 0 ||
                    structure.getSize()[1] === 0 ||
                    structure.getSize()[2] === 0
                ) {
                    props.onError &&
                        props.onError(new Error("Empty structure loaded"));
                }

                setStructure(structure);

                const resources = new ResourceManager();
                await Promise.all([
                    resources.loadFromZip(props.assetsPath || "/assets.zip"),
                    resources.loadBlocks(
                        "https://raw.githubusercontent.com/Arcensoth/mcdata/master/processed/reports/blocks/simplified/data.min.json"
                    ),
                ]);

                if (!canvasRef.current) return;
                const renderer = new StructureRenderer(
                    canvasRef.current.getContext("webgl2")!,
                    structure,
                    resources,
                    {
                        useInvisibleBlockBuffer: false,
                    }
                );

                setRenderer(renderer);

                setCpos([-8, -structure.getSize()[1] + 16, -8]);
                setCrot([Math.PI / 4, Math.PI / 4]);
                setCdist(32);
            } catch (error) {
                if (props.onError) props.onError(error as any);
            }
        })();
    }, [chunks, props.regionPath]);

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
                position: "relative",
            }}
        >
            {!renderer &&
                (props.spinner || (
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            opacity: 0.2,
                            fontSize: "1.5em",
                            color: "white",
                            position: "absolute",
                            inset: 0,
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
                onTouchStart={(e) => {
                    onMouseDown({
                        clientX: e.touches[e.touches.length - 1].clientX,
                        clientY: e.touches[e.touches.length - 1].clientY,
                        button: e.touches.length > 1 ? 0 : 2,
                        distance:
                            e.touches.length === 1
                                ? 0
                                : vec2.distance(
                                      [
                                          e.touches[0].clientX,
                                          e.touches[0].clientY,
                                      ],
                                      [
                                          e.touches[1].clientX,
                                          e.touches[1].clientY,
                                      ]
                                  ),
                    });
                    setTouchStartDistance(
                        e.touches.length === 1
                            ? 0
                            : vec2.distance(
                                  [e.touches[0].clientX, e.touches[0].clientY],
                                  [e.touches[1].clientX, e.touches[1].clientY]
                              )
                    );
                    e.preventDefault();
                }}
                onTouchMove={(e) => {
                    onMouseMove({
                        clientX: e.touches[e.touches.length - 1].clientX,
                        clientY: e.touches[e.touches.length - 1].clientY,
                        button: e.touches.length > 1 ? 0 : 2,
                        distance:
                            e.touches.length === 1
                                ? 0
                                : vec2.distance(
                                      [
                                          e.touches[0].clientX,
                                          e.touches[0].clientY,
                                      ],
                                      [
                                          e.touches[1].clientX,
                                          e.touches[1].clientY,
                                      ]
                                  ),
                    });
                    if (!touchStartDistance) {
                        setTouchStartDistance(
                            e.touches.length === 1
                                ? 0
                                : vec2.distance(
                                      [
                                          e.touches[0].clientX,
                                          e.touches[0].clientY,
                                      ],
                                      [
                                          e.touches[1].clientX,
                                          e.touches[1].clientY,
                                      ]
                                  )
                        );
                    }
                    e.preventDefault();
                }}
                onTouchEnd={(e) => {
                    onMouseUp();
                    e.preventDefault();
                }}
            />
        </div>
    );
}
