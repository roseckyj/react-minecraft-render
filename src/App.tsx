import { Box as ChakraBox } from "@chakra-ui/react";
import { MinecraftChunk } from "./MinecraftChunk";

function App() {
    return (
        <ChakraBox position="fixed" inset={0}>
            <MinecraftChunk />
        </ChakraBox>
    );
}

export default App;
