//! SIMD-optimized audio processing primitives
//! 
//! Uses WebAssembly SIMD (128-bit) for 4x parallel f32 operations.
//! Fallback to scalar when SIMD is unavailable.

#[cfg(target_arch = "wasm32")]
use std::arch::wasm32::*;

/// Process 4 samples at once using SIMD
/// Applies gain and accumulates into output buffer
#[cfg(all(target_arch = "wasm32", feature = "simd"))]
#[inline(always)]
pub fn simd_gain_4(input: &[f32; 4], gain: f32) -> [f32; 4] {
    unsafe {
        let input_v = v128_load(input.as_ptr() as *const v128);
        let gain_v = f32x4_splat(gain);
        let result = f32x4_mul(input_v, gain_v);
        
        let mut output = [0.0f32; 4];
        v128_store(output.as_mut_ptr() as *mut v128, result);
        output
    }
}

/// Scalar fallback
#[cfg(not(all(target_arch = "wasm32", feature = "simd")))]
#[inline(always)]
pub fn simd_gain_4(input: &[f32; 4], gain: f32) -> [f32; 4] {
    [
        input[0] * gain,
        input[1] * gain,
        input[2] * gain,
        input[3] * gain,
    ]
}

/// SIMD mix: out = dry * (1-wet) + wet_signal * wet
#[cfg(all(target_arch = "wasm32", feature = "simd"))]
#[inline(always)]
pub fn simd_mix_4(dry: &[f32; 4], wet_signal: &[f32; 4], wet: f32) -> [f32; 4] {
    unsafe {
        let dry_v = v128_load(dry.as_ptr() as *const v128);
        let wet_v = v128_load(wet_signal.as_ptr() as *const v128);
        let wet_amt = f32x4_splat(wet);
        let dry_amt = f32x4_splat(1.0 - wet);
        
        let dry_scaled = f32x4_mul(dry_v, dry_amt);
        let wet_scaled = f32x4_mul(wet_v, wet_amt);
        let result = f32x4_add(dry_scaled, wet_scaled);
        
        let mut output = [0.0f32; 4];
        v128_store(output.as_mut_ptr() as *mut v128, result);
        output
    }
}

#[cfg(not(all(target_arch = "wasm32", feature = "simd")))]
#[inline(always)]
pub fn simd_mix_4(dry: &[f32; 4], wet_signal: &[f32; 4], wet: f32) -> [f32; 4] {
    let dry_amt = 1.0 - wet;
    [
        dry[0] * dry_amt + wet_signal[0] * wet,
        dry[1] * dry_amt + wet_signal[1] * wet,
        dry[2] * dry_amt + wet_signal[2] * wet,
        dry[3] * dry_amt + wet_signal[3] * wet,
    ]
}

/// SIMD add: a + b
#[cfg(all(target_arch = "wasm32", feature = "simd"))]
#[inline(always)]
pub fn simd_add_4(a: &[f32; 4], b: &[f32; 4]) -> [f32; 4] {
    unsafe {
        let a_v = v128_load(a.as_ptr() as *const v128);
        let b_v = v128_load(b.as_ptr() as *const v128);
        let result = f32x4_add(a_v, b_v);
        
        let mut output = [0.0f32; 4];
        v128_store(output.as_mut_ptr() as *mut v128, result);
        output
    }
}

#[cfg(not(all(target_arch = "wasm32", feature = "simd")))]
#[inline(always)]
pub fn simd_add_4(a: &[f32; 4], b: &[f32; 4]) -> [f32; 4] {
    [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]]
}

/// Process audio buffer in SIMD chunks
/// Returns number of samples processed with SIMD (remainder needs scalar)
#[inline]
pub fn process_buffer_simd<F>(
    input: &[f32],
    output: &mut [f32],
    mut process_chunk: F,
) -> usize
where
    F: FnMut(&[f32; 4]) -> [f32; 4],
{
    let simd_len = (input.len() / 4) * 4;
    
    for i in (0..simd_len).step_by(4) {
        let chunk: [f32; 4] = [
            input[i],
            input[i + 1],
            input[i + 2],
            input[i + 3],
        ];
        
        let result = process_chunk(&chunk);
        
        output[i] = result[0];
        output[i + 1] = result[1];
        output[i + 2] = result[2];
        output[i + 3] = result[3];
    }
    
    simd_len
}

/// SIMD-optimized linear interpolation
/// Interpolates between 4 pairs of values
#[cfg(all(target_arch = "wasm32", feature = "simd"))]
#[inline(always)]
pub fn simd_lerp_4(a: &[f32; 4], b: &[f32; 4], t: f32) -> [f32; 4] {
    unsafe {
        let a_v = v128_load(a.as_ptr() as *const v128);
        let b_v = v128_load(b.as_ptr() as *const v128);
        let t_v = f32x4_splat(t);
        let one_minus_t = f32x4_splat(1.0 - t);
        
        // result = a * (1-t) + b * t
        let a_scaled = f32x4_mul(a_v, one_minus_t);
        let b_scaled = f32x4_mul(b_v, t_v);
        let result = f32x4_add(a_scaled, b_scaled);
        
        let mut output = [0.0f32; 4];
        v128_store(output.as_mut_ptr() as *mut v128, result);
        output
    }
}

#[cfg(not(all(target_arch = "wasm32", feature = "simd")))]
#[inline(always)]
pub fn simd_lerp_4(a: &[f32; 4], b: &[f32; 4], t: f32) -> [f32; 4] {
    let one_minus_t = 1.0 - t;
    [
        a[0] * one_minus_t + b[0] * t,
        a[1] * one_minus_t + b[1] * t,
        a[2] * one_minus_t + b[2] * t,
        a[3] * one_minus_t + b[3] * t,
    ]
}

/// Fast approximation of sin using SIMD
/// Uses Taylor series approximation, good for LFOs
#[cfg(all(target_arch = "wasm32", feature = "simd"))]
#[inline(always)]
pub fn simd_sin_approx_4(x: &[f32; 4]) -> [f32; 4] {
    // Normalize to [-PI, PI] range assumed
    // sin(x) ≈ x - x³/6 + x⁵/120
    unsafe {
        let x_v = v128_load(x.as_ptr() as *const v128);
        let x2 = f32x4_mul(x_v, x_v);
        let x3 = f32x4_mul(x2, x_v);
        let x5 = f32x4_mul(x3, x2);
        
        let c3 = f32x4_splat(1.0 / 6.0);
        let c5 = f32x4_splat(1.0 / 120.0);
        
        // x - x³/6 + x⁵/120
        let term1 = x_v;
        let term2 = f32x4_mul(x3, c3);
        let term3 = f32x4_mul(x5, c5);
        
        let result = f32x4_add(f32x4_sub(term1, term2), term3);
        
        let mut output = [0.0f32; 4];
        v128_store(output.as_mut_ptr() as *mut v128, result);
        output
    }
}

#[cfg(not(all(target_arch = "wasm32", feature = "simd")))]
#[inline(always)]
pub fn simd_sin_approx_4(x: &[f32; 4]) -> [f32; 4] {
    // Scalar fallback uses fast approximation
    fn fast_sin(x: f32) -> f32 {
        let x2 = x * x;
        let x3 = x2 * x;
        let x5 = x3 * x2;
        x - x3 / 6.0 + x5 / 120.0
    }
    [fast_sin(x[0]), fast_sin(x[1]), fast_sin(x[2]), fast_sin(x[3])]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simd_gain() {
        let input = [1.0, 2.0, 3.0, 4.0];
        let result = simd_gain_4(&input, 2.0);
        assert_eq!(result, [2.0, 4.0, 6.0, 8.0]);
    }

    #[test]
    fn test_simd_mix() {
        let dry = [1.0, 1.0, 1.0, 1.0];
        let wet = [0.0, 0.0, 0.0, 0.0];
        let result = simd_mix_4(&dry, &wet, 0.5);
        assert_eq!(result, [0.5, 0.5, 0.5, 0.5]);
    }
}
