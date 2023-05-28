import { computeProjectedPlaneUVs } from './utils';

const teapotPath: string = new URL(
  '../../assets/obj/teapot.obj',
  import.meta.url
).toString();

const mesh = {
  positions: [] as [number, number, number][],
  triangles: [] as [number, number, number][],
  normals: [] as [number, number, number][],
  uvs: [] as [number, number][],
};

const scaleFactor = 50;
let minX: number;
let minY: number;
let maxZ: number;
let maxX: number;
let maxY: number;
let minZ: number;

fetch(teapotPath)
  .then((res) => res.text())
  .then((objText) => {
    const lines = objText.split('\n');

    for (const line of lines) {
      const parts = line.split(' ');
      switch (parts[0]) {
        case 'v':
          const position: [number, number, number] = [
            parseFloat(parts[1]) * scaleFactor,
            parseFloat(parts[2]) * scaleFactor,
            parseFloat(parts[3]) * scaleFactor,
          ];
          if (minX === undefined || position[0] < minX) {
            minX = position[0];
          }
          if (maxX === undefined || position[0] > maxX) {
            maxX = position[0];
          }
          if (minY === undefined || position[1] < minY) {
            minY = position[1];
          }
          if (maxY === undefined || position[1] > maxY) {
            maxY = position[1];
          }
          if (maxZ === undefined || position[2] > maxZ) {
            maxZ = position[2];
          }
          if (minZ === undefined || position[2] < minZ) {
            minZ = position[2];
          }
          mesh.positions.push(position);
          break;
        case 'vn':
          const normal: [number, number, number] = [
            parseFloat(parts[1]),
            parseFloat(parts[2]),
            parseFloat(parts[3]),
          ];
          mesh.normals.push(normal);
          break;
        case 'f':
          const triangle: [number, number, number] = [
            parseInt(parts[1].split('//')[0]) - 1,
            parseInt(parts[2].split('//')[0]) - 1,
            parseInt(parts[3].split('//')[0]) - 1,
          ];
          mesh.triangles.push(triangle);
          break;
        default:
          break;
      }
    }
  })
  .then(() => {
    mesh.uvs = computeProjectedPlaneUVs(mesh.positions, 'xy');

    // Push vertex attributes for an additional ground plane
    // prettier-ignore
    mesh.positions.push(
        [-100, 20, -100], //
        [ 100, 20,  100], //
        [-100, 20,  100], //
        [ 100, 20, -100]
      );
    mesh.normals.push(
      [0, 1, 0], //
      [0, 1, 0], //
      [0, 1, 0], //
      [0, 1, 0]
    );
    mesh.uvs.push(
      [0, 0], //
      [1, 1], //
      [0, 1], //
      [1, 0]
    );
  });

export default mesh;
