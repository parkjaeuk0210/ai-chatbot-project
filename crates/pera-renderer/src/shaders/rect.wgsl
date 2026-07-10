struct Globals {
    viewport: vec2<f32>,
    _padding: vec2<f32>,
};

@group(0) @binding(0)
var<uniform> globals: Globals;

struct VertexInput {
    @location(0) unit_position: vec2<f32>,
    @location(1) rect: vec4<f32>,
    @location(2) color: vec4<f32>,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    let viewport = max(globals.viewport, vec2<f32>(1.0, 1.0));
    let pixel = input.rect.xy + input.unit_position * input.rect.zw;
    let ndc = vec2<f32>(
        (pixel.x / viewport.x) * 2.0 - 1.0,
        1.0 - (pixel.y / viewport.y) * 2.0,
    );

    var output: VertexOutput;
    output.position = vec4<f32>(ndc, 0.0, 1.0);
    output.color = input.color;
    return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    return input.color;
}
