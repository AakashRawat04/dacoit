// Examples:
// - decodeBencode("5:hello") -> "hello"
// - decodeBencode("10:hello12345") -> "hello12345"
function decodeBencode(bencodedValue: string): string|number {
    /* This function is used to decode a bencoded string
    The bencoded string is a string that is prefixed by the length of the string
    **/

    // Check if the first character is a digit
    // string
    if (!isNaN(parseInt(bencodedValue[0]))) {
        const firstColonIndex = bencodedValue.indexOf(":");
        if (firstColonIndex === -1) {
            throw new Error("Invalid encoded value");
        }
        return bencodedValue.substring(firstColonIndex + 1);
    }
    // integer 
    else if (bencodedValue[0] === "i" && bencodedValue[bencodedValue.length-1] === "e") {
        const integer = parseInt(bencodedValue.substring(1, bencodedValue.length - 1));
        return integer;
    } else {
        throw new Error("Only strings are supported at the moment");
    }
}

const args = process.argv;
const bencodedValue = args[3];

if (args[2] === "decode") {
    // TODO: Uncomment the code below to pass the first stage
    try {
        const decoded = decodeBencode(bencodedValue);
        console.log(JSON.stringify(decoded));
    } catch (error) {
        console.error((error as Error).message);
    }
}
