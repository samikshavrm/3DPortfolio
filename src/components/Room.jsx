import { Html, useGLTF, useTexture } from "@react-three/drei";
import { SRGBColorSpace, LinearFilter, CubeTextureLoader, ShaderMaterial, Texture, MeshPhysicalMaterial, DoubleSide, Euler } from "three";
import { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { useFrame } from "@react-three/fiber";
import { GiClick } from "react-icons/gi";

import themeVertexShader from "../shaders/theme/vertex.glsl";
import themeFragmentShader from "../shaders/theme/fragment.glsl";

import CoffeeSmoke from "./CoffeeSmoke.jsx";

const textureMap = {
  First: {
    day: "/textures/room/first_texture_set_day.webp",
    night: "/textures/room/first_texture_set_night.webp",
    nightLight: "/textures/room/first_texture_set_night_light.webp",
  },
  Second: {
    day: "/textures/room/second_texture_set_day.webp",
    night: "/textures/room/second_texture_set_night.webp",
    nightLight: "/textures/room/second_texture_set_night_light.webp",
  },
};

const useRoomTextures = () => {
  const day = {};
  const night = {};
  const nightLight = {};

  Object.entries(textureMap).forEach(([key, paths]) => {
    day[key] = useTexture(paths.day);
    day[key].flipY = false;
    day[key].colorSpace = SRGBColorSpace
    day[key].minFilter = LinearFilter
    day[key].magFilter = LinearFilter

    night[key] = useTexture(paths.night);
    night[key].flipY = false;
    night[key].colorSpace = SRGBColorSpace
    night[key].minFilter = LinearFilter
    night[key].magFilter = LinearFilter

    nightLight[key] = useTexture(paths.nightLight);
    nightLight[key].flipY = false;
    nightLight[key].colorSpace = SRGBColorSpace
    nightLight[key].minFilter = LinearFilter
    nightLight[key].magFilter = LinearFilter
  });

  return { day, night, nightLight };
};

export default function Room({ isNight, handleChairClick, handleCertificateClick, isCameraFocused }) {
  const groupRef = useRef();
  const { scene } = useGLTF("/models/filbert_room_folio.glb");
  const { day, night, nightLight } = useRoomTextures();

  const [roomMaterials, setRoomMaterials] = useState({});
  const [isChairClicked, setIsChairClicked] = useState(false);
  const [isCertificateClicked, setIsCertificateClicked] = useState(false);

  const chairTopRef = useRef(null);
  const fansRef = useRef([]);

  const environmentMap = new CubeTextureLoader()
    .setPath("textures/skybox/")
    .load(["px.webp", "nx.webp", "py.webp", "ny.webp", "pz.webp", "nz.webp"]);

  useEffect(() => {
    const createMaterialForTextureSet = (textureSet) => {
      const material = new ShaderMaterial({
          uniforms: {
            uDayTexture1: { value: day.First },
            uNightTexture1: { value: night.First },
            uNightLightTexture1: { value: nightLight.First },
            uDayTexture2: { value: day.Second },
            uNightTexture2: { value: night.Second },
            uNightLightTexture2: { value: nightLight.Second },
            uMixRatioTheme: { value: 0 },
            uMixRatioLight: { value: 0 },
            uTextureSet: { value: textureSet },
          },
          vertexShader: themeVertexShader,
          fragmentShader: themeFragmentShader,
        });
      
        Object.entries(material.uniforms).forEach(([key, uniform]) => {
          if (uniform.value instanceof Texture) {
            uniform.value.minFilter = LinearFilter;
            uniform.value.magFilter = LinearFilter;
          }
        });
      
        return material;
    };
    
    setRoomMaterials({
        First: createMaterialForTextureSet(1),
        Second: createMaterialForTextureSet(2),
    });
  }, [])
  

  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        if (child.name.includes("Glass")) {
          child.material = new MeshPhysicalMaterial({
            transmission: 1,
            opacity: 1,
            color: 0xfbfbfb,
            metalness: 0,
            roughness: 0,
            ior: 3,
            thickness: 0.01,
            specularIntensity: 1,
            envMap: environmentMap,
            envMapIntensity: 1,
            depthWrite: false,
            specularColor: 0xfbfbfb,
          });
        } else {
          Object.keys(roomMaterials).forEach((key) => {
            if (child.name.includes(key)) {
                child.material = roomMaterials[key];

                if (child.name.includes("Double_Side")) {
                  child.material.side = DoubleSide;
                }

                if (child.name.includes("Chair_Top")) {
                  chairTopRef.current = child;
                  if (!child.userData.initialRotation) {
                    child.userData.initialRotation = new Euler().copy(child.rotation);
                  }
                }
                
                if (child.name.includes("Fan")) {
                  fansRef.current.push(child);
                }
            }
          });
        }
      }
    });
  }, [scene, roomMaterials]);

  useEffect(() => {
    Object.values(roomMaterials).forEach((material) => {
      const tl = gsap.timeline();
      if (isNight) {
        tl.to(material.uniforms.uMixRatioTheme, {
          value: 1,
          duration: 1,
          ease: "power2.inOut",
        }).to(material.uniforms.uMixRatioLight, {
          value: 1,
          duration: 0.5,
          ease: "power2.inOut",
        });
      } else {
        tl.to(material.uniforms.uMixRatioLight, {
          value: 0,
          duration: 0.5,
          ease: "power2.inOut",
        }).to(material.uniforms.uMixRatioTheme, {
          value: 0,
          duration: 1,
          ease: "power2.inOut",
        });
      }
    });
  }, [isNight]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const baseAmplitude = Math.PI / 6;
    const bias = -1 // adjust this value to control how much extra bias to the left

    fansRef.current.forEach((fan) => {
      fan.rotation.y -= 0.015;
    });

    if (chairTopRef.current) {
      // Shifting the sine value produces asymmetric amplitude while keeping the cosine derivative intact.
      const rotationOffset = baseAmplitude * (Math.sin(time * 0.5) - bias);
      chairTopRef.current.rotation.y = chairTopRef.current.userData.initialRotation.y - rotationOffset;
    }
  });

  return (
    <primitive ref={groupRef} object={scene}>
      {!isChairClicked && (
        <Html
          transform
          wrapperClass="htmlScreen"
          distanceFactor={ 0.97 }
          position={ [ 1, 3, 0.5 ] }
          rotation-z={-Math.PI / 8}
          rotation-x={-Math.PI / 4}
          rotation-y={Math.PI / 4}
          zIndexRange={[10, 0]}
        >
          <GiClick 
            size={200} 
            onClick={() => {
              if (isCameraFocused) return;
              setIsChairClicked(true);
              handleChairClick();
            }}
            className={`text-white animate-pulse ${isCameraFocused ? "" : "cursor-pointer"}`}
          />
        </Html>
      )}

      {!isCertificateClicked && (
        <Html
          transform
          wrapperClass="htmlScreen"
          distanceFactor={ 0.97 }
          position={ [ -3.7, 7, -0.5 ] }
          rotation-x={-Math.PI / 3}
          rotation-y={Math.PI / 2}
          zIndexRange={[10, 0]}
        >
          <GiClick 
            size={200} 
            onClick={() => {
              if (isCameraFocused) return;
              setIsCertificateClicked(true);
              handleCertificateClick();
            }}
            className={`text-white animate-pulse ${isCameraFocused ? "" : "cursor-pointer"}`}
          />
        </Html>
      )}


      <Html
          transform
          wrapperClass="htmlScreen"
          distanceFactor={ 0.97 }
          position={ [ -3.089, 4.840, -0.307 ] }
          rotation-y={ Math.PI / 2}
          occlude="blending"
          zIndexRange={[10, 0]}
      >
          <iframe src="https://samikshavrm.github.io/PortfolioPC/"></iframe>
      </Html>

      <mesh
        scale={[2, 2, 2]}
        position={[0.5, 3, -0.8]}
        onClick={() => {
          if (isCameraFocused) return;
          setIsChairClicked(true);
          handleChairClick();
        }}
        onPointerOver={() => {
         if (isCameraFocused) return;
         document.body.style.cursor = "pointer"
        }}
        onPointerOut={() => document.body.style.cursor = "default"}
        visible={false}
      >
        <boxGeometry />
      </mesh>

      <mesh
        scale={[0.1, 1.8, 2.8]}
        position={[-3.9, 7.05, -1]}
        onClick={() => {
          if (isCameraFocused) return;
          setIsCertificateClicked(true);
          handleCertificateClick();
        }}
        onPointerOver={() => {
          if (isCameraFocused) return;
          document.body.style.cursor = "pointer"
        }}
        onPointerOut={() => document.body.style.cursor = "default"}
        visible={false}
      >
        <boxGeometry />
      </mesh>

      <CoffeeSmoke />
    </primitive>
  );
};