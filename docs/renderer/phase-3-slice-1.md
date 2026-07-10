# Phase 3 — wgpu renderer · Slice 1

## 목표

첫 슬라이스는 기존 렌더링 경로를 제거하지 않고, 브라우저에서 실행 가능한 Rust/Wasm 렌더러의 최소 수직 단면을 추가한다.

- `wgpu` 디바이스와 캔버스 surface 초기화
- WebGPU 우선, WebGL2 자동 폴백
- 배경 clear pass
- 인스턴싱 기반 단색 사각형 파이프라인
- CSS 크기, device pixel ratio, resize 처리
- Konva와 GPU 렌더러를 선택하는 기능 플래그
- GPU 초기화 실패 시 Konva로 복귀
- 독립 데모와 CI

텍스트 셰이핑(`cosmic-text`), R-tree 컬링/히트테스팅, 이미지/패스, 선택 핸들, 카메라 변환은 후속 슬라이스 범위다.

## 현재 저장소와의 경계

이 브랜치의 기반인 `feat/pera-studio-ui-v2`에는 실제 Konva 캔버스 기능이 아직 없다. 그래서 이번 슬라이스는 다음 두 계층을 독립적으로 제공한다.

1. `crates/pera-renderer`: 실제 GPU 렌더링 코어
2. `js/renderer`: 기존 Konva 구현을 주입할 수 있는 브라우저 어댑터와 전환 파사드

메인 Studio 화면은 변경하지 않는다. 기본 렌더러도 계속 `konva`이므로, Wasm 산출물이 없거나 GPU가 실패해도 기존 제품 경로에 영향이 없다.

## 디렉터리

```text
Cargo.toml
rust-toolchain.toml
crates/pera-renderer/
  Cargo.toml
  src/lib.rs
  src/renderer.rs
  src/shaders/rect.wgsl
js/renderer/
  featureFlags.js
  scene.js
  gpuRenderer.js
  konvaAdapter.js
  rendererFacade.js
  demo.js
renderer-demo.html
docs/renderer/phase-3-slice-1.md
.github/workflows/renderer-ci.yml
```

## 빌드

Rust 1.87과 `wasm32-unknown-unknown` target이 필요하다.

```bash
cargo install wasm-pack --locked
npm run renderer:build
npm run dev
```

그다음 아래 경로를 연다.

```text
http://localhost:3000/renderer-demo.html?renderer=auto
```

개발 빌드는 다음 명령을 사용한다.

```bash
npm run renderer:build:dev
```

생성물은 `renderer/pkg/`에 위치하며 Git에는 포함하지 않는다.

## 기능 플래그

우선순위는 URL query → localStorage → 안전 기본값 순서다.

| 값 | 동작 |
| --- | --- |
| `renderer=konva` | Konva만 초기화한다. 기본값이다. |
| `renderer=gpu` | GPU를 먼저 시도하고, 실패하면 기본적으로 Konva로 폴백한다. |
| `renderer=auto` | GPU 실험군 모드다. GPU 실패 시 Konva로 폴백한다. |

localStorage 키는 `pera.renderer.mode`다.

```js
import { setRendererMode } from './js/renderer/featureFlags.js';

setRendererMode('auto');
```

## 파사드 사용 예시

```js
import { RendererFacade } from './js/renderer/rendererFacade.js';

const renderer = await RendererFacade.create({
  canvas: document.querySelector('#gpu-canvas'),
  legacyContainer: document.querySelector('#konva-container'),
  mode: 'auto',
  onStatus(status) {
    console.info('renderer status', status);
  },
});

renderer.setScene({
  clearColor: '#0b1020',
  rectangles: [
    { x: 20, y: 20, width: 180, height: 80, color: '#6d8cff' },
  ],
});
renderer.render();
```

기존 Konva 씬의 생성 규칙이 다르면 `legacyFactory`를 주입한다.

```js
const renderer = await RendererFacade.create({
  canvas,
  legacyContainer,
  mode: 'auto',
  legacyFactory: ({ container }) => existingKonvaScene.mount(container),
});
```

주입된 구현은 아래 최소 계약을 만족해야 한다.

```text
resize(width, height, devicePixelRatio?)
setClearColor(color)
setRectangles(rectangles)
render()
destroy()
backend / adapterName / apiVersion / rectCount
```

## Wasm 사각형 프로토콜

JS 어댑터는 사각형 하나를 `Float32Array`의 8개 값으로 패킹한다.

```text
x, y, width, height, red, green, blue, alpha
```

- 좌표와 크기는 CSS logical pixel이다.
- 색상은 0..1 범위 RGBA다.
- 크기가 음수면 0으로 정규화한다.
- non-finite 값은 Wasm 경계를 넘기기 전에 거부하고, Rust에서도 다시 검증한다.
- 정점 6개짜리 unit quad 하나를 재사용하고 사각형 데이터만 instance buffer로 올린다.

## 리사이즈와 DPR

JS는 `ResizeObserver`로 CSS 크기를 측정하고 현재 `devicePixelRatio`를 Rust에 전달한다. Rust는 다음 두 크기를 분리한다.

- viewport uniform: CSS logical size
- surface/canvas backing store: logical size × DPR

DPR은 과도한 VRAM 사용을 막기 위해 최대 4로 제한한다.

## 폴백 규칙

1. `wgpu::util::new_instance_with_webgpu_detection`으로 WebGPU 지원을 실제 adapter 요청까지 확인한다.
2. WebGPU를 사용할 수 없으면 같은 `wgpu` 파이프라인을 WebGL2 backend로 초기화한다.
3. Wasm 로딩, surface 생성, adapter/device 생성 중 하나라도 실패하면 JS 파사드가 Konva를 초기화한다.
4. 기본 모드는 `konva`다. 플래그가 켜지지 않은 사용자는 GPU 코드를 로드하지 않는다.

## 검증

```bash
npm run check
npm run renderer:check
```

CI는 다음을 수행한다.

- JS 문법 검사
- Node 내장 test runner로 기능 플래그와 사각형 패킹 테스트
- `cargo fmt --check`
- wasm32 target `cargo check`
- wasm32 target Clippy (`-D warnings`)

## 완료 기준

- Konva 모드가 기본이며 기존 Studio 화면이 바뀌지 않는다.
- 데모에서 배경과 5개 사각형이 Konva로 그려진다.
- Wasm을 빌드한 뒤 GPU/Auto 모드에서 동일한 scene payload가 wgpu로 그려진다.
- WebGPU가 없는 환경에서는 WebGL2를 시도한다.
- GPU 전체 초기화가 실패하면 Konva로 복귀하고 원인을 상태 UI에 표시한다.
- resize와 DPR 변경 뒤에도 logical 좌표가 유지된다.

## 다음 슬라이스

다음 단계는 렌더러 입력을 일회성 배열이 아닌 scene command/model로 승격하고, 카메라 transform과 dirty-frame 스케줄러를 추가하는 것이다. 그 위에 R-tree 인덱스와 hit-test 계약을 얹은 뒤 `cosmic-text` 텍스트 atlas로 확장한다.
