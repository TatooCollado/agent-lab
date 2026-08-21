import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";

const env = loadEnv();
const app = createApp();

app.listen(env.PORT, () => {
  console.info(`Agent Lab backend listening on http://localhost:${env.PORT}`);
});

