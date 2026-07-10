//! PERA Studio GPU renderer.
//!
//! Slice 1 intentionally exposes only a clear pass and instanced rectangles. Text,
//! spatial indexing, and richer scene primitives are added in later Phase 3 slices.

#![cfg(target_arch = "wasm32")]

mod renderer;

pub use renderer::GpuRenderer;

use wasm_bindgen::prelude::*;
use web_sys::HtmlCanvasElement;

/// Initialize the panic hook as soon as the Wasm module is loaded.
#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

/// Create a renderer attached to an existing HTML canvas.
#[wasm_bindgen]
pub async fn create_renderer(canvas: HtmlCanvasElement) -> Result<GpuRenderer, JsValue> {
    GpuRenderer::new(canvas).await
}

/// Version of the JavaScript-facing renderer contract.
#[wasm_bindgen]
pub fn renderer_api_version() -> String {
    env!("CARGO_PKG_VERSION").to_owned()
}
