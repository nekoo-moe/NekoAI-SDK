# Packaging & Publishing Plugins

This guide explains how to package, test locally, and publish your NekoAI plugins.

---

## 1. Local Sideloading (Development Mode)

During development, you can test your plugin live in the NekoAI Tamagotchi desktop client without publishing to npm:

1. Build your plugin:
   ```bash
   pnpm run build
   ```
2. Verify the manifest:
   ```bash
   npx @nekotech/create-neko-plugin lint .
   ```
3. Open NekoAI Desktop Tamagotchi -> **Settings** -> **Plugins**.
4. Click **Add Local Plugin** and select your project's root folder containing `plugin.json`.
5. Your plugin will load into an isolated worker thread immediately. Check the **DevTools > Plugin Host** tab for live logs and heartbeat metrics.

---

## 2. Publishing to NPM

NekoAI plugins are standard npm packages:

1. Ensure your `package.json` specifies `"files"` including `"plugin.json"`, `"dist"`, and `"README.md"`:
   ```json
   {
     "name": "neko-plugin-weather",
     "version": "1.0.0",
     "files": [
       "plugin.json",
       "dist",
       "README.md"
     ]
   }
   ```
2. Build the package:
   ```bash
   pnpm run build
   ```
3. Publish to npm:
   ```bash
   npm publish --access public
   ```

---

## 3. Registering in the Community Plugin Registry

Once published to npm, submit a pull request to add your plugin to the official NekoAI community registry index so users can discover and install it with one click!
