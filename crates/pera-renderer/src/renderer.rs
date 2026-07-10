use std::mem::size_of;

use bytemuck::{Pod, Zeroable};
use js_sys::Float32Array;
use wasm_bindgen::prelude::*;
use web_sys::HtmlCanvasElement;
use wgpu::util::DeviceExt;

const FLOATS_PER_RECT: usize = 8;
const INITIAL_INSTANCE_CAPACITY: usize = 64;
const MAX_DEVICE_PIXEL_RATIO: f32 = 4.0;

const UNIT_QUAD: [[f32; 2]; 6] = [
    [0.0, 0.0],
    [1.0, 0.0],
    [0.0, 1.0],
    [0.0, 1.0],
    [1.0, 0.0],
    [1.0, 1.0],
];

const VERTEX_ATTRIBUTES: [wgpu::VertexAttribute; 1] = wgpu::vertex_attr_array![0 => Float32x2];
const INSTANCE_ATTRIBUTES: [wgpu::VertexAttribute; 2] =
    wgpu::vertex_attr_array![1 => Float32x4, 2 => Float32x4];

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct Globals {
    viewport: [f32; 2],
    padding: [f32; 2],
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct RectInstance {
    rect: [f32; 4],
    color: [f32; 4],
}

/// Browser renderer exported to JavaScript through wasm-bindgen.
#[wasm_bindgen]
pub struct GpuRenderer {
    canvas: HtmlCanvasElement,
    surface: wgpu::Surface<'static>,
    device: wgpu::Device,
    queue: wgpu::Queue,
    config: wgpu::SurfaceConfiguration,
    pipeline: wgpu::RenderPipeline,
    globals_buffer: wgpu::Buffer,
    globals_bind_group: wgpu::BindGroup,
    vertex_buffer: wgpu::Buffer,
    instance_buffer: wgpu::Buffer,
    instance_capacity: usize,
    instance_count: u32,
    clear_color: wgpu::Color,
    logical_width: f32,
    logical_height: f32,
    device_pixel_ratio: f32,
    backend: String,
    adapter_name: String,
}

impl GpuRenderer {
    pub(crate) async fn new(canvas: HtmlCanvasElement) -> Result<Self, JsValue> {
        let instance = wgpu::util::new_instance_with_webgpu_detection(
            wgpu::InstanceDescriptor::new_without_display_handle(),
        )
        .await;

        let surface: wgpu::Surface<'static> = instance
            .create_surface(wgpu::SurfaceTarget::Canvas(canvas.clone()))
            .map_err(|error| js_error("GPU surface creation failed", error))?;

        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: Some(&surface),
                force_fallback_adapter: false,
            })
            .await
            .map_err(|error| js_error("No compatible WebGPU/WebGL2 adapter", error))?;

        let adapter_info = adapter.get_info();
        let backend = format!("{:?}", adapter_info.backend).to_lowercase();
        let adapter_name = adapter_info.name.clone();

        let (device, queue) = adapter
            .request_device(&wgpu::DeviceDescriptor {
                label: Some("PERA renderer device"),
                required_features: wgpu::Features::empty(),
                required_limits: wgpu::Limits::downlevel_webgl2_defaults()
                    .using_resolution(adapter.limits()),
                experimental_features: wgpu::ExperimentalFeatures::disabled(),
                memory_hints: wgpu::MemoryHints::MemoryUsage,
                trace: wgpu::Trace::Off,
            })
            .await
            .map_err(|error| js_error("GPU device creation failed", error))?;

        let logical_width = positive_dimension(canvas.client_width() as f32).unwrap_or(1.0);
        let logical_height = positive_dimension(canvas.client_height() as f32).unwrap_or(1.0);
        let device_pixel_ratio = 1.0;
        let physical_width = physical_dimension(logical_width, device_pixel_ratio);
        let physical_height = physical_dimension(logical_height, device_pixel_ratio);

        canvas.set_width(physical_width);
        canvas.set_height(physical_height);

        let config = surface
            .get_default_config(&adapter, physical_width, physical_height)
            .ok_or_else(|| {
                JsValue::from_str("The selected adapter cannot present to this canvas")
            })?;
        surface.configure(&device, &config);

        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("PERA rectangle shader"),
            source: wgpu::ShaderSource::Wgsl(include_str!("shaders/rect.wgsl").into()),
        });

        let globals = Globals {
            viewport: [logical_width, logical_height],
            padding: [0.0; 2],
        };
        let globals_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("PERA viewport uniform"),
            contents: bytemuck::bytes_of(&globals),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });
        let globals_bind_group_layout =
            device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("PERA globals bind group layout"),
                entries: &[wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::VERTEX,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                }],
            });
        let globals_bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("PERA globals bind group"),
            layout: &globals_bind_group_layout,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: globals_buffer.as_entire_binding(),
            }],
        });

        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("PERA rectangle pipeline layout"),
            bind_group_layouts: &[&globals_bind_group_layout],
            immediate_size: 0,
        });
        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("PERA rectangle pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                compilation_options: wgpu::PipelineCompilationOptions::default(),
                buffers: &[
                    wgpu::VertexBufferLayout {
                        array_stride: size_of::<[f32; 2]>() as wgpu::BufferAddress,
                        step_mode: wgpu::VertexStepMode::Vertex,
                        attributes: &VERTEX_ATTRIBUTES,
                    },
                    wgpu::VertexBufferLayout {
                        array_stride: size_of::<RectInstance>() as wgpu::BufferAddress,
                        step_mode: wgpu::VertexStepMode::Instance,
                        attributes: &INSTANCE_ATTRIBUTES,
                    },
                ],
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                compilation_options: wgpu::PipelineCompilationOptions::default(),
                targets: &[Some(wgpu::ColorTargetState {
                    format: config.format,
                    blend: Some(wgpu::BlendState::ALPHA_BLENDING),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
            }),
            primitive: wgpu::PrimitiveState {
                topology: wgpu::PrimitiveTopology::TriangleList,
                strip_index_format: None,
                front_face: wgpu::FrontFace::Ccw,
                cull_mode: None,
                unclipped_depth: false,
                polygon_mode: wgpu::PolygonMode::Fill,
                conservative: false,
            },
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview_mask: None,
            cache: None,
        });

        let vertex_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("PERA unit quad vertices"),
            contents: bytemuck::cast_slice(&UNIT_QUAD),
            usage: wgpu::BufferUsages::VERTEX,
        });
        let instance_capacity = INITIAL_INSTANCE_CAPACITY;
        let instance_buffer = create_instance_buffer(&device, instance_capacity);

        Ok(Self {
            canvas,
            surface,
            device,
            queue,
            config,
            pipeline,
            globals_buffer,
            globals_bind_group,
            vertex_buffer,
            instance_buffer,
            instance_capacity,
            instance_count: 0,
            clear_color: wgpu::Color {
                r: 0.043,
                g: 0.063,
                b: 0.125,
                a: 1.0,
            },
            logical_width,
            logical_height,
            device_pixel_ratio,
            backend,
            adapter_name,
        })
    }

    fn write_globals(&self) {
        let globals = Globals {
            viewport: [self.logical_width, self.logical_height],
            padding: [0.0; 2],
        };
        self.queue
            .write_buffer(&self.globals_buffer, 0, bytemuck::bytes_of(&globals));
    }

    fn configure_surface(&self) {
        self.surface.configure(&self.device, &self.config);
    }
}

#[wasm_bindgen]
impl GpuRenderer {
    /// Resize in CSS pixels and supply the browser's current devicePixelRatio.
    pub fn resize(
        &mut self,
        logical_width: f32,
        logical_height: f32,
        device_pixel_ratio: f32,
    ) -> Result<(), JsValue> {
        self.logical_width = positive_dimension(logical_width).ok_or_else(|| {
            JsValue::from_str("logical_width must be finite and greater than zero")
        })?;
        self.logical_height = positive_dimension(logical_height).ok_or_else(|| {
            JsValue::from_str("logical_height must be finite and greater than zero")
        })?;
        self.device_pixel_ratio = positive_dimension(device_pixel_ratio)
            .ok_or_else(|| {
                JsValue::from_str("device_pixel_ratio must be finite and greater than zero")
            })?
            .min(MAX_DEVICE_PIXEL_RATIO);

        self.config.width = physical_dimension(self.logical_width, self.device_pixel_ratio);
        self.config.height = physical_dimension(self.logical_height, self.device_pixel_ratio);
        self.canvas.set_width(self.config.width);
        self.canvas.set_height(self.config.height);
        self.write_globals();
        self.configure_surface();
        Ok(())
    }

    /// Set the background clear color. Components are clamped to 0..=1.
    pub fn set_clear_color(&mut self, red: f64, green: f64, blue: f64, alpha: f64) {
        self.clear_color = wgpu::Color {
            r: finite_unit(red),
            g: finite_unit(green),
            b: finite_unit(blue),
            a: finite_unit(alpha),
        };
    }

    /// Upload rectangles packed as x, y, width, height, red, green, blue, alpha.
    pub fn set_rectangles(&mut self, packed: Float32Array) -> Result<(), JsValue> {
        let float_count = packed.length() as usize;
        if float_count % FLOATS_PER_RECT != 0 {
            return Err(JsValue::from_str(
                "rectangle data length must be a multiple of 8",
            ));
        }

        let mut values = vec![0.0_f32; float_count];
        packed.copy_to(&mut values);

        let instances = values
            .chunks_exact(FLOATS_PER_RECT)
            .enumerate()
            .map(|(index, value)| {
                if !value.iter().all(|component| component.is_finite()) {
                    return Err(JsValue::from_str(&format!(
                        "rectangle {index} contains a non-finite number"
                    )));
                }

                Ok(RectInstance {
                    rect: [value[0], value[1], value[2].max(0.0), value[3].max(0.0)],
                    color: [
                        value[4].clamp(0.0, 1.0),
                        value[5].clamp(0.0, 1.0),
                        value[6].clamp(0.0, 1.0),
                        value[7].clamp(0.0, 1.0),
                    ],
                })
            })
            .collect::<Result<Vec<_>, JsValue>>()?;

        if instances.len() > self.instance_capacity {
            self.instance_capacity = instances.len().next_power_of_two();
            self.instance_buffer = create_instance_buffer(&self.device, self.instance_capacity);
        }

        if !instances.is_empty() {
            self.queue
                .write_buffer(&self.instance_buffer, 0, bytemuck::cast_slice(&instances));
        }
        self.instance_count = instances.len() as u32;
        Ok(())
    }

    /// Draw the current scene. Occluded/timeout frames are skipped without failing.
    pub fn render(&mut self) -> Result<(), JsValue> {
        let (frame, reconfigure_after_present) = match self.surface.get_current_texture() {
            wgpu::CurrentSurfaceTexture::Success(frame) => (frame, false),
            wgpu::CurrentSurfaceTexture::Suboptimal(frame) => (frame, true),
            wgpu::CurrentSurfaceTexture::Timeout | wgpu::CurrentSurfaceTexture::Occluded => {
                return Ok(())
            }
            wgpu::CurrentSurfaceTexture::Outdated | wgpu::CurrentSurfaceTexture::Lost => {
                self.configure_surface();
                return Ok(());
            }
            wgpu::CurrentSurfaceTexture::Validation => {
                return Err(JsValue::from_str(
                    "GPU surface validation failed while acquiring a frame",
                ))
            }
        };

        let view = frame
            .texture
            .create_view(&wgpu::TextureViewDescriptor::default());
        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("PERA frame encoder"),
            });

        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("PERA background and rectangles"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    depth_slice: None,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(self.clear_color),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
                multiview_mask: None,
            });
            pass.set_pipeline(&self.pipeline);
            pass.set_bind_group(0, &self.globals_bind_group, &[]);
            pass.set_vertex_buffer(0, self.vertex_buffer.slice(..));
            pass.set_vertex_buffer(1, self.instance_buffer.slice(..));
            pass.draw(0..UNIT_QUAD.len() as u32, 0..self.instance_count);
        }

        self.queue.submit(Some(encoder.finish()));
        self.queue.present(frame);

        if reconfigure_after_present {
            self.configure_surface();
        }
        Ok(())
    }

    #[wasm_bindgen(getter)]
    pub fn backend(&self) -> String {
        self.backend.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn adapter_name(&self) -> String {
        self.adapter_name.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn rect_count(&self) -> u32 {
        self.instance_count
    }
}

fn create_instance_buffer(device: &wgpu::Device, capacity: usize) -> wgpu::Buffer {
    device.create_buffer(&wgpu::BufferDescriptor {
        label: Some("PERA rectangle instances"),
        size: (capacity.max(1) * size_of::<RectInstance>()) as wgpu::BufferAddress,
        usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
        mapped_at_creation: false,
    })
}

fn positive_dimension(value: f32) -> Option<f32> {
    (value.is_finite() && value > 0.0).then_some(value)
}

fn physical_dimension(logical: f32, device_pixel_ratio: f32) -> u32 {
    (logical * device_pixel_ratio)
        .round()
        .clamp(1.0, u32::MAX as f32) as u32
}

fn finite_unit(value: f64) -> f64 {
    if value.is_finite() {
        value.clamp(0.0, 1.0)
    } else {
        0.0
    }
}

fn js_error(context: &str, error: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&format!("{context}: {error}"))
}
