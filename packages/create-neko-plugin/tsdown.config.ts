import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/cli.ts',
    'src/scaffold.ts',
    'src/linter.ts',
  ],
  dts: true,
  format: 'esm',
})
