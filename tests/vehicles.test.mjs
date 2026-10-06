import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildCar,disposeCar,vehicleSpecs} from '../src/cars.js';
const ids=Object.keys(vehicleSpecs);
const colors=['#779eab','#e86527','#b62f32','#445e36','#d6b44e','#b7b3a4'];
for(const [index,id] of ids.entries())test(`3D ${id}: product identity, geometry, wheels and materials`,()=>{
 const car=buildCar({id,color:colors[index]});assert.equal(car.name,id);assert.equal(car.userData.productId,id);assert.equal(car.userData.color,colors[index]);assert.equal(car.userData.wheels.length,4);
 const skin=car.getObjectByName('cabin-skin');assert.ok(skin);const normal=skin.geometry.getAttribute('normal');for(const i of [8,9,14,15])assert.ok(normal.getY(i)>.2,'roof normals face outward/up, not inside the cabin');
 car.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(car),size=box.getSize(new THREE.Vector3());assert.ok(size.x>=vehicleSpecs[id].length);assert.ok(size.y>1);assert.ok(size.z>1.6);let meshes=0,paint=0;
 car.traverse(o=>{if(!o.isMesh)return;meshes++;assert.ok(o.geometry.getAttribute('position').count>=3);const positions=o.geometry.getAttribute('position').array;assert.ok(positions.every(Number.isFinite));assert.ok(o.material);if(o.material.isMeshPhysicalMaterial&&o.material.color.getHexString()===colors[index].slice(1))paint++;});assert.ok(meshes>40);assert.ok(paint>5);disposeCar(car);
});
test('Each casting has its own silhouette contract, not a recolored common car',()=>{const shapes=ids.map(id=>JSON.stringify(vehicleSpecs[id]));assert.equal(new Set(shapes).size,ids.length);assert.ok(vehicleSpecs.defender.height>vehicleSpecs.porsche.height);assert.ok(vehicleSpecs.mustang.length>vehicleSpecs.civic.length);});
