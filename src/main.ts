import {
	CineonToneMapping,
	Color,
	CubeReflectionMapping,
	CubeTextureLoader,
	DirectionalLight,
	DoubleSide,
	IcosahedronGeometry,
	Layers,
	Mesh,
	MeshDepthMaterial,
	MeshPhysicalMaterial,
	MeshStandardMaterial,
	PCFSoftShadowMap,
	PerspectiveCamera,
	PlaneGeometry,
	RGBADepthPacking,
	Scene,
	ShaderChunk,
	ShaderMaterial,
	SRGBColorSpace,
	Uniform,
	Vector2,
	WebGLRenderer,
} from 'three';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Pane } from 'tweakpane';
import './index.css';
import fragmentShader from './shader/fragment.glsl?raw';
import simplex2DNoise from './shader/include/simplex2DNoise.glsl?raw';
import simplex3DNoise from './shader/include/simplex3DNoise.glsl?raw';
import simplex4DNoise from './shader/include/simplex4DNoise.glsl?raw';
import shaderPassFragmentShader from './shader/pass/fragment.glsl?raw';
import shaderPassVertexShader from './shader/pass/vertex.glsl?raw';
import vertexShader from './shader/vertex.glsl?raw';
// @ts-ignore
ShaderChunk['simplex2DNoise'] = simplex2DNoise;
// @ts-ignore
ShaderChunk['simplex4DNoise'] = simplex4DNoise;
// @ts-ignore
ShaderChunk['simplex3DNoise'] = simplex3DNoise;

const size = {
	width: window.innerWidth,
	height: window.innerHeight,
};

const el = document.querySelector('#app') as HTMLDivElement;

const BLOOM_SCENE = 1;

const bloomLayer = new Layers();
bloomLayer.set(BLOOM_SCENE);

/**
 * Basic
 */

const renderer = new WebGLRenderer({
	alpha: true,
	antialias: true,
});
renderer.setSize(size.width, size.height);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = CineonToneMapping;
renderer.toneMappingExposure = 0.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
el.append(renderer.domElement);

const scene = new Scene();

const camera = new PerspectiveCamera(75, size.width / size.height, 0.1, 1000);
camera.position.set(5, 5, -5);
camera.lookAt(scene.position);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

/**
 * Post Processing
 */

const renderPass = new RenderPass(scene, camera);

const bloomPass = new UnrealBloomPass(
	new Vector2(size.width, size.height),
	0.5, // strength
	0.25, // radius
	0.2 // threshold
);

const composer = new EffectComposer(renderer);

const bloomComposer = new EffectComposer(renderer);
bloomComposer.renderToScreen = false;
bloomComposer.addPass(renderPass);
bloomComposer.addPass(bloomPass);

const shaderPass = new ShaderPass(
	new ShaderMaterial({
		vertexShader: shaderPassVertexShader,
		fragmentShader: shaderPassFragmentShader,
		uniforms: {
			baseTexture: { value: null },
			bloomTexture: { value: bloomComposer.renderTarget2.texture },
		},
	}),
	'baseMaterial'
);
shaderPass.needsSwap = true;

const outPass = new OutputPass();

composer.addPass(renderPass);
composer.addPass(shaderPass);
composer.addPass(outPass);

/**
 * Loaders
 */

const cubeTextureLoader = new CubeTextureLoader();
cubeTextureLoader.setPath('/src/assets/texture/0/');

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('node_modules/three/examples/jsm/libs/draco/');
dracoLoader.setDecoderConfig({ type: 'js' });
dracoLoader.preload();

const gltfLoader = new GLTFLoader();
gltfLoader.dracoLoader = dracoLoader;
gltfLoader.setPath('/src/assets/');

/**
 * Textures
 */

cubeTextureLoader.load(
	['px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg'],
	(data) => {
		data.mapping = CubeReflectionMapping;

		scene.background = data;
		scene.environment = data;
		scene.environmentIntensity = 0.5;
	}
);

/**
 * Scene
 */

const uniforms = {
	uProcess: new Uniform(0.0),
	uFrequency: new Uniform(0.85),
	uEdgeColor: new Uniform(new Color(0x4d9bff)),
	uStrength: new Uniform(16.0),
	uEdge: new Uniform(0.8),
};

const sphereGeometry = new IcosahedronGeometry(2, 32);
const sphereMaterial = new CustomShaderMaterial({
	baseMaterial: MeshPhysicalMaterial,

	roughness: 0.0,
	metalness: 1.0,
	transmission: 0.0,
	transparent: true,
	side: DoubleSide,

	fragmentShader,
	vertexShader,
	uniforms,
}) as unknown as MeshPhysicalMaterial;
const depthMaterial = new CustomShaderMaterial({
	baseMaterial: MeshDepthMaterial,

	depthPacking: RGBADepthPacking,

	fragmentShader: fragmentShader
		.replace(`csm_Emissive = uEdgeColor;`, '')
		.replace('csm_Metalness = 0.0;', '')
		.replace('csm_Roughness = 1.0;', ''),
	vertexShader,
	uniforms,
}) as unknown as MeshDepthMaterial;
const sphere = new Mesh(sphereGeometry, sphereMaterial);
sphere.layers.enable(BLOOM_SCENE);

gltfLoader.load('suzanne.glb', (data) => {
	const suzanne = data.scene.children[0] as Mesh;

	suzanne.material = sphereMaterial;
	suzanne.customDepthMaterial = depthMaterial;

	suzanne.castShadow = true;
	suzanne.receiveShadow = true;
	scene.add(suzanne);
});

const shadowTest = new Mesh(
	new PlaneGeometry(10, 10, 32, 32),
	new MeshStandardMaterial({ color: 0xffffff })
);
shadowTest.rotation.x = Math.PI;
shadowTest.position.z = 5.0;
shadowTest.receiveShadow = true;
scene.add(shadowTest);

/**
 * Light
 */

const directionalLight = new DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(0, 0, -5.0);
directionalLight.castShadow = true;
scene.add(directionalLight);

/**
 * Pane
 */

const pane = new Pane({ title: 'Debug Params' });
pane.element.parentElement!.style.width = '380px';
pane.addBinding(uniforms.uProcess, 'value', {
	label: 'Process',
	min: -20,
	max: 20,
	step: 0.001,
});
pane.addBinding(uniforms.uFrequency, 'value', {
	label: 'Frequency',
	min: 0,
	max: 1,
	step: 0.001,
});
pane.addBinding(uniforms.uStrength, 'value', {
	label: 'Strength',
	min: 1,
	max: 20,
	step: 1.0,
});
pane.addBinding(uniforms.uEdgeColor, 'value', {
	label: 'Edge Color',
	color: {
		type: 'float',
	},
}).on('change', (val) => uniforms.uEdgeColor.value.set(new Color(val.value)));

/**
 * Events
 */

function render(time: number = 0) {
	bloomComposer.render();

	composer.render();

	controls.update(time);

	requestAnimationFrame(render);
}
render();

function resize() {
	size.width = window.innerWidth;
	size.height = window.innerHeight;

	renderer.setSize(size.width, size.height);

	camera.aspect = size.width / size.height;
	camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
