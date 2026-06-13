/**
 * Ambient declaration for the `three` package.
 *
 * The installed three.js build ships no bundled type declarations and
 * `@types/three` is not a dependency, so under `strict` mode importing it
 * raises TS7016. The 3D renderer uses three's runtime API dynamically
 * (meshes, materials, geometries mutated per-frame), so we declare the module
 * as `any` here. This preserves the prior behaviour (the renderer was authored
 * in untyped `.js` with `checkJs:false`) while letting the file compile as
 * TypeScript. The renderer's own public API (ThreeScene, exported functions)
 * remains explicitly typed.
 */
declare module 'three';
declare module 'three/addons/*';
