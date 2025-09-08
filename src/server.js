import app from "./app.js";
import { env } from "./config/env.js";
import chalk from "chalk";

const server = app.listen(env.PORT, () => {
    const base = `http://localhost:${env.PORT}`;
    if (env.LOG_PRETTY) {
        console.log(chalk.bgGreen.black(" UP "), chalk.white(`API ${env.NODE_ENV} ${base}`));
        if (env.SWAGGER_ENABLED) {
            console.log(chalk.bgBlue.black(" DOC "), chalk.white(`${base}/api-docs`));
            console.log(chalk.bgBlue.black(" DOC "), chalk.white(`${base}/openapi.json`));
        }
    } else {
        console.log(`UP api=${base} env=${env.NODE_ENV}`);
        if (env.SWAGGER_ENABLED) {
            console.log(`DOC ${base}/api-docs`);
            console.log(`DOC ${base}/openapi.json`);
        }
    }
});

function shutdown() {
    server.close(() => {
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
