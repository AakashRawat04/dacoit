// Examples:
// - decodeBencode("5:hello") -> "hello"

import { parseBencode } from "./parser";

const args = process.argv;
const bencodedValue = args[3];

if (args[2] === "decode") {
    // TODO: Uncomment the code below to pass the first stage
    try {
        // const decoded = decodeBencode(bencodedValue);
        const decoded = parseBencode(Buffer.from(bencodedValue))[0];
        console.log(JSON.stringify(decoded));
    } catch (error) {
        console.error((error as Error).message);
    }
}
