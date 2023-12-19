import * as THREE from "three";

export async function loadMinecraftBlock(
    block: string,
    data: Record<string, unknown> = {}
) {
    const variant = await loadVariant(block, data);
    if (variant === null) return null;

    const model = await loadModel(variant.model);
    if (model === null) return null;

    console.log(model);

    const textures = loadTextures(model);

    const meshes = Object.keys(textures).map((texture) => {
        const geometry = createMesh(model, texture);

        return new THREE.Mesh(
            geometry,
            new THREE.ShaderMaterial({
                uniforms: {
                    uSampler: {
                        value: textures[texture],
                    },
                },
                vertexShader: `
                    varying highp vec2 vUv;
                    void main() {
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }`,
                fragmentShader: `
                    precision mediump float;
                    uniform sampler2D uSampler;
                    varying highp vec2 vUv;
                    void main() {
                        gl_FragColor = texture(uSampler, vUv);
                        if (gl_FragColor.a < 0.1) discard;
                    }`,
                side: THREE.FrontSide,
                transparent: true,
            })
        );
    });

    return meshes;
}

async function loadVariant(block: string, data: Record<string, unknown> = {}) {
    try {
        const blockstateResponse = await fetch(
            "/assets/blockstates/" + block + ".json"
        );
        const blockstate = await blockstateResponse.json();

        // TODO: Handle multipart
        const variants = Object.entries(blockstate.variants)
            .filter(([key, _]) => {
                if (key === "") return true;

                const entries = key.split(",").reduce((acc, cur) => {
                    const [k, v] = cur.split("=");
                    acc[k] = v;
                    return acc;
                }, {} as Record<string, string>);

                return Object.entries(data).every(
                    ([k, v]) =>
                        entries[k] === String(v) || entries[k] === undefined
                );
            })
            .map(([_, v]) => v as Variant | Variant[]);

        if (variants.length === 0) {
            console.error("No variants found for block " + block);
            return null;
        }

        let variant: Variant = variants[0] as Variant;
        if ((variant as any as Variant[]).length !== undefined) {
            // TODO: Weighted random
            variant = (variant as any as Variant[])[0];
        }

        return variant;
    } catch (e) {
        console.error("Error loading variant for block " + block);
        console.error(e);
        return null;
    }
}

async function loadModel(path: string) {
    try {
        const modelResponse = await fetch(
            "/assets/models/" + pathFromId(path) + ".json"
        );
        let model = (await modelResponse.json()) as Model;

        if (model.parent !== undefined) {
            const parentModel = await loadModel(model.parent);
            if (parentModel === null) return null;

            parentModel.textures = {
                ...parentModel.textures,
                ...model.textures,
            };
            if (model.elements !== undefined) {
                parentModel.elements = model.elements;
            }
            model = parentModel;
        }

        resolveModelTextures(model);
        return model;
    } catch (e) {
        console.error("Error loading model " + path);
        console.error(e);
        return null;
    }
}

function resolveModelTextures(model: Model) {
    (model.elements || []).forEach((element, i) => {
        Object.entries(element.faces).forEach(([faceKey, face]) => {
            if (face.texture.startsWith("#")) {
                const texture = (model.textures || {})[
                    face.texture.substring(1)
                ];
                if (texture !== undefined) {
                    (model.elements[i].faces as any)[faceKey].texture = texture;
                }
            }
        });
    });
}

function loadTextures(model: Model) {
    const textures: Record<string, THREE.Texture> = {};

    (model.elements || []).forEach((element) => {
        Object.entries(element.faces).forEach(([_, face]) => {
            textures[pathFromId(face.texture)] = new THREE.TextureLoader().load(
                "assets/textures/" + pathFromId(face.texture) + ".png",
                (texture) => {
                    texture.magFilter = THREE.NearestFilter;
                    texture.minFilter = THREE.NearestFilter;
                    texture.needsUpdate = true;
                }
            );
        });
    });

    return textures;
}

function createMesh(model: Model, forTexture: string): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();

    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const indexCullFaces: (string | null)[] = [];

    (model.elements || []).forEach((element, i) => {
        let [x1, y1, z1] = element.from;
        let [x2, y2, z2] = element.to;
        x1 /= 16;
        y1 /= 16;
        z1 /= 16;
        x2 /= 16;
        y2 /= 16;
        z2 /= 16;

        Object.entries(element.faces).forEach(([faceKey, face]) => {
            if (pathFromId(face.texture) !== forTexture) return;

            const faceVertices = {
                up: [
                    [x1, y2, z2],
                    [x2, y2, z2],
                    [x2, y2, z1],
                    [x1, y2, z1],
                ],
                down: [
                    [x1, y1, z1],
                    [x2, y1, z1],
                    [x2, y1, z2],
                    [x1, y1, z2],
                ],
                east: [
                    [x2, y2, z1],
                    [x2, y2, z2],
                    [x2, y1, z2],
                    [x2, y1, z1],
                ],
                west: [
                    [x1, y2, z2],
                    [x1, y2, z1],
                    [x1, y1, z1],
                    [x1, y1, z2],
                ],
                north: [
                    [x1, y2, z1],
                    [x2, y2, z1],
                    [x2, y1, z1],
                    [x1, y1, z1],
                ],
                south: [
                    [x2, y2, z2],
                    [x1, y2, z2],
                    [x1, y1, z2],
                    [x2, y1, z2],
                ],
            }[faceKey] as number[][];

            const faceNormals = {
                up: [0, 1, 0],
                down: [0, -1, 0],
                east: [1, 0, 0],
                west: [-1, 0, 0],
                north: [0, 0, -1],
                south: [0, 0, 1],
            }[faceKey] as number[];

            const rawFaceUVs = face.uv
                ? face.uv.map((val) => val / 16)
                : ({
                      up: [x1, z1, x2, z2],
                      down: [x1, z1, x2, z2],
                      east: [x1, y1, x2, y2],
                      west: [x1, y1, x2, y2],
                      north: [z1, y1, z2, y2],
                      south: [z1, y1, z2, y2],
                  }[faceKey] as number[]);

            let faceUVs = [
                [rawFaceUVs[0], 1 - rawFaceUVs[1]],
                [rawFaceUVs[2], 1 - rawFaceUVs[1]],
                [rawFaceUVs[2], 1 - rawFaceUVs[3]],
                [rawFaceUVs[0], 1 - rawFaceUVs[3]],
            ];

            if (face.rotation !== undefined) {
                // Rotation can be only 0, 90, 180, 270 so we can use a lookup table
                const rotation = face.rotation / 90;
                const lookupTable = [
                    [0, 1, 2, 3],
                    [1, 2, 3, 0],
                    [2, 3, 0, 1],
                    [3, 0, 1, 2],
                ][rotation];

                faceUVs = lookupTable.map((i) => faceUVs[i]);
            }

            indices.push(
                vertices.length / 3,
                vertices.length / 3 + 1,
                vertices.length / 3 + 2,
                vertices.length / 3,
                vertices.length / 3 + 2,
                vertices.length / 3 + 3
            );
            indexCullFaces.push(...Array(6).fill(face.cullface || null));

            vertices.push(...faceVertices.flat(1));
            normals.push(...Array(4).fill(faceNormals).flat(1));
            uvs.push(...faceUVs.flat(1));
        });
    });

    geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(vertices), 3)
    );
    geometry.setAttribute(
        "normal",
        new THREE.BufferAttribute(new Float32Array(normals), 3)
    );
    geometry.setAttribute(
        "uv",
        new THREE.BufferAttribute(new Float32Array(uvs), 2)
    );

    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));

    return geometry;
}

function pathFromId(id: string) {
    if (id.includes(":")) {
        return id.split(":")[1];
    } else {
        return id;
    }
}

export type Variant = {
    model: string;
    uvlock?: boolean;
    x?: number;
    y?: number;
    weight?: number;
};

export type Model = {
    parent?: string;
    textures?: Record<string, string>;
    elements: ModelElement[];
};

export type ModelElement = {
    from: [number, number, number];
    to: [number, number, number];
    rotation?: {
        origin: [number, number, number];
        axis: "x" | "y" | "z";
        angle: number;
        rescale?: boolean;
    };
    faces: {
        north?: ModelFace;
        south?: ModelFace;
        east?: ModelFace;
        west?: ModelFace;
        up?: ModelFace;
        down?: ModelFace;
    };
};

export type ModelFace = {
    uv?: [number, number, number, number];
    texture: string;
    cullface?: "north" | "south" | "east" | "west" | "up" | "down";
    rotation?: number;
    tintindex?: number;
};
