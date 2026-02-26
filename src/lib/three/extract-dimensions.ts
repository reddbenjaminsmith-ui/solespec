import * as THREE from "three";

export interface ModelDimensions {
  width: number; // X axis (mm)
  height: number; // Y axis (mm)
  depth: number; // Z axis (mm)
  center: { x: number; y: number; z: number };
  boundingBox: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
}

/**
 * Extract bounding box dimensions from a Three.js object.
 * Returns dimensions in the model's native units (typically mm for footwear CAD).
 */
export function extractDimensions(object: THREE.Object3D): ModelDimensions {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  return {
    width: size.x,
    height: size.y,
    depth: size.z,
    center: { x: center.x, y: center.y, z: center.z },
    boundingBox: {
      min: { x: box.min.x, y: box.min.y, z: box.min.z },
      max: { x: box.max.x, y: box.max.y, z: box.max.z },
    },
  };
}

/**
 * Calculate the optimal camera distance to frame the entire model.
 * Used to auto-fit the camera on model load.
 */
export function calculateCameraDistance(
  dimensions: ModelDimensions,
  fov: number = 50
): number {
  const maxDimension = Math.max(
    dimensions.width,
    dimensions.height,
    dimensions.depth
  );
  const fovRadians = (fov * Math.PI) / 180;
  // Add 20% padding
  return (maxDimension / (2 * Math.tan(fovRadians / 2))) * 1.2;
}
