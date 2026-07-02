import dataService from "./shared/dataService";

async function run() {
    // Override API endpoint internally for test (local or prod?) defaults to /api/query
    // Actually wait, dataService uses postJson which hits /api/... relative path.
    // In node.js, relative fetch will throw an error. We need to set up a mock or absolute URL.
}
run();
