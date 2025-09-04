import app from "./app.js";
import { env } from "./config/env.js";

const PORT = env.PORT;

app.listen(PORT, () => {
    console.log(`🚀 API running at http://localhost:${PORT}`);
    console.log(`📑 Swagger Docs: http://localhost:${PORT}/api-docs`);
    console.log(`🧾 OpenAPI JSON: http://localhost:${PORT}/openapi.json`);
});
