import type { NbtFile } from "deepslate";
import { BlockState, NbtType, Structure } from "deepslate";

const VERSION_20w17a = 2529;
const VERSION_21w43a = 2844;

export function loadStructure(files: NbtFile[]) {
    const masterFile = files[0];

    let minX = masterFile.root.getNumber("xPos");
    let minZ = masterFile.root.getNumber("zPos");
    let maxX = minX;
    let maxZ = minZ;

    const dataVersion = masterFile.root.getNumber("DataVersion");
    const N = dataVersion >= VERSION_21w43a;
    const stretches = dataVersion < VERSION_20w17a;

    let minY = Infinity;
    let maxY = -Infinity;

    for (const file of files) {
        const sections = N
            ? file.root.getList("sections", NbtType.Compound)
            : file.root
                  .getCompound("Level")
                  .getList("Sections", NbtType.Compound);

        const filledSections = sections.filter((section) => {
            const palette = N
                ? section
                      .getCompound("block_states")
                      .getList("palette", NbtType.Compound)
                : section.has("Palette") &&
                  section.getList("Palette", NbtType.Compound);
            return (
                palette &&
                palette.filter(
                    (state) => state.getString("Name") !== "minecraft:air"
                ).length > 0
            );
        });
        if (filledSections.length === 0) {
            throw new Error("Empty chunk");
        }
        minY = Math.min(
            minY,
            16 * Math.min(...filledSections.map((s) => s.getNumber("Y")))
        );
        maxY = Math.max(
            maxY,
            16 * Math.max(...filledSections.map((s) => s.getNumber("Y")))
        );

        const xPos = file.root.getNumber("xPos");
        const zPos = file.root.getNumber("zPos");

        minX = Math.min(minX, xPos);
        maxX = Math.max(maxX, xPos);
        minZ = Math.min(minZ, zPos);
        maxZ = Math.max(maxZ, zPos);
    }

    const structure = new Structure([
        (maxX - minX + 1) * 16,
        maxY - minY + 16,
        (maxZ - minZ + 1) * 16,
    ]);

    for (const file of files) {
        const xPos = (file.root.getNumber("xPos") - minX) * 16;
        const zPos = (file.root.getNumber("zPos") - minZ) * 16;

        const sections = N
            ? file.root.getList("sections", NbtType.Compound)
            : file.root
                  .getCompound("Level")
                  .getList("Sections", NbtType.Compound);

        const filledSections = sections.filter((section) => {
            const palette = N
                ? section
                      .getCompound("block_states")
                      .getList("palette", NbtType.Compound)
                : section.has("Palette") &&
                  section.getList("Palette", NbtType.Compound);
            return (
                palette &&
                palette.filter(
                    (state) => state.getString("Name") !== "minecraft:air"
                ).length > 0
            );
        });
        if (filledSections.length === 0) {
            throw new Error("Empty chunk");
        }

        const K_palette = N ? "palette" : "Palette";
        const K_data = N ? "data" : "BlockStates";

        for (const section of filledSections) {
            const states = N ? section.getCompound("block_states") : section;
            if (!states.has(K_palette) || !states.has(K_data)) {
                continue;
            }
            const yOffset = section.getNumber("Y") * 16 - minY;
            const palette = states.getList(K_palette, NbtType.Compound);
            const blockStates = states.getLongArray(K_data);
            const tempDataview = new DataView(new Uint8Array(8).buffer);
            const statesData = blockStates.map((long) => {
                tempDataview.setInt32(0, Number(long.getAsPair()[0]));
                tempDataview.setInt32(4, Number(long.getAsPair()[1]));
                return tempDataview.getBigUint64(0);
            });

            const bits = Math.max(4, Math.ceil(Math.log2(palette.length)));
            const bigBits = BigInt(bits);
            const big64 = BigInt(64);
            const bitMask = BigInt(Math.pow(2, bits) - 1);
            let state = 0;
            let data = statesData[state];
            let dataLength = big64;

            for (let j = 0; j < 4096; j += 1) {
                if (dataLength < bits) {
                    state += 1;
                    const newData = statesData[state];
                    if (stretches) {
                        data = (newData << dataLength) | data;
                        dataLength += big64;
                    } else {
                        data = newData;
                        dataLength = big64;
                    }
                }
                const paletteId = data & bitMask;
                const blockState = palette.get(Number(paletteId));
                if (blockState) {
                    const pos: [number, number, number] = [
                        j & 0xf,
                        yOffset + (j >> 8),
                        (j >> 4) & 0xf,
                    ];
                    const block = BlockState.fromNbt(blockState);
                    structure.addBlock(
                        [pos[0] + xPos, pos[1], pos[2] + zPos],
                        block.getName(),
                        block.getProperties()
                    );
                }
                data >>= bigBits;
                dataLength -= bigBits;
            }
        }
    }

    console.log("Loaded structure");
    return structure;
}
