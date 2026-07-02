import fs from "fs";
const p = "../Fodda API/Fodda/package.json";
const js = JSON.parse(fs.readFileSync(p, "utf-8"));
console.log("Current version:", js.version);
