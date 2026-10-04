import * as THREE from 'three';

/**
 * Frees GPU resources for everything under `root`. Removing an object from a scene does NOT release
 * its geometry, material or texture buffers; skipping this leaks memory on every scene switch.
 */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();

    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    const materials = Array.isArray(mat) ? mat : mat ? [mat] : [];
    for (const m of materials) {
      for (const value of Object.values(m)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      m.dispose();
    }

    const inst = obj as THREE.InstancedMesh;
    if (inst.isInstancedMesh) inst.dispose();
  });
}
