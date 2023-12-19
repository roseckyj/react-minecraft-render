import type {
    BlockDefinitionProvider,
    BlockFlagsProvider,
    BlockModelProvider,
    BlockPropertiesProvider,
    Identifier,
    TextureAtlasProvider,
} from "deepslate";
import { BlockDefinition, BlockModel, TextureAtlas } from "deepslate";
import jszip from "jszip";
import { OPAQUE_BLOCKS } from "./BlockFlags";

const opaque = new Set(OPAQUE_BLOCKS);

export class ResourceManager
    implements
        BlockModelProvider,
        BlockDefinitionProvider,
        BlockFlagsProvider,
        TextureAtlasProvider,
        BlockPropertiesProvider
{
    private blockDefinitions: { [id: string]: BlockDefinition };
    private blockModels: { [id: string]: BlockModel };
    private blockAtlas: TextureAtlas;
    private blocks: Record<
        string,
        {
            default: Record<string, string>;
            properties: Record<string, string[]>;
        }
    >;

    constructor() {
        this.blockDefinitions = {};
        this.blockModels = {};
        this.blockAtlas = TextureAtlas.empty();
        this.blocks = {};
    }

    public getBlockDefinition(id: Identifier) {
        return this.blockDefinitions[id.toString()];
    }

    public getBlockModel(id: Identifier) {
        return this.blockModels[id.toString()];
    }

    public getTextureUV(id: Identifier) {
        return this.blockAtlas.getTextureUV(id);
    }

    public getTextureAtlas() {
        return this.blockAtlas.getTextureAtlas();
    }

    public getBlockFlags(id: Identifier) {
        return {
            opaque: opaque.has(id.toString()),
        };
    }

    public getBlockProperties(id: Identifier) {
        return this.blocks[id.toString()]?.properties ?? null;
    }

    public getDefaultBlockProperties(id: Identifier) {
        return this.blocks[id.toString()]?.default ?? null;
    }

    public async loadFromZip(url: string) {
        const assetsBuffer = await (await fetch(url)).arrayBuffer();
        const assets = await jszip.loadAsync(assetsBuffer);
        await this.loadFromFolderJson(
            assets.folder("minecraft/blockstates")!,
            async (id, data) => {
                id = "minecraft:" + id;
                this.blockDefinitions[id] = BlockDefinition.fromJson(id, data);
            }
        );
        await this.loadFromFolderJson(
            assets.folder("minecraft/models/block")!,
            async (id, data) => {
                id = "minecraft:block/" + id;
                this.blockModels[id] = BlockModel.fromJson(id, data);
            }
        );
        const textures: { [id: string]: Blob } = {};
        await this.loadFromFolderPng(
            assets.folder("minecraft/textures/block")!,
            async (id, data) => {
                textures["minecraft:block/" + id] = data;
            }
        );
        this.blockAtlas = await TextureAtlas.fromBlobs(textures);
        Object.values(this.blockModels).forEach((m) => m.flatten(this));
    }

    private loadFromFolderJson(
        folder: jszip,
        callback: (id: string, data: any) => Promise<void>
    ) {
        const promises: Promise<void>[] = [];
        folder.forEach((path, file) => {
            if (file.dir || !path.endsWith(".json")) return;
            const id = path.replace(/\.json$/, "");
            promises.push(
                file
                    .async("text")
                    .then((data) => callback(id, JSON.parse(data)))
            );
        });
        return Promise.all(promises);
    }

    private loadFromFolderPng(
        folder: jszip,
        callback: (id: string, data: Blob) => Promise<void>
    ) {
        const promises: Promise<void>[] = [];
        folder.forEach((path, file) => {
            if (file.dir || !path.endsWith(".png")) return;
            const id = path.replace(/\.png$/, "");
            promises.push(
                file.async("blob").then((data) => callback(id, data))
            );
        });
        return Promise.all(promises);
    }

    public async loadBlocks(url: string) {
        this.blocks = await (await fetch(url)).json();
    }
}
