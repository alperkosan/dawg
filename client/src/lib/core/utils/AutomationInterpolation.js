/**
 * Automation Interpolation Utilities
 * 
 * Provides various interpolation methods for smooth automation curves.
 * Industry Standard: FL Studio (linear), Ableton Live (linear + exponential + bezier),
 * Logic Pro (multi-curve), Pro Tools (linear + bezier)
 * 
 * Supported Methods:
 * - linear: Straight line between points
 * - exponential: Smooth exponential curve
 * - logarithmic: Smooth logarithmic curve
 * - bezier: Cubic bezier curve (smooth S-curve)
 * - cubic: Cubic spline interpolation
 * - step: No interpolation (step-wise)
 */

export class AutomationInterpolation {
    /**
     * Linear interpolation
     * 
     * @param {number} from - Start value
     * @param {number} to - End value
     * @param {number} t - Progress (0-1)
     * @returns {number} Interpolated value
     */
    static linear(from, to, t) {
        return from + (to - from) * t;
    }

    /**
     * Exponential interpolation (smooth acceleration/deceleration)
     * 
     * @param {number} from - Start value
     * @param {number} to - End value
     * @param {number} t - Progress (0-1)
     * @param {number} exponent - Curve exponent (default: 2, higher = steeper)
     * @returns {number} Interpolated value
     */
    static exponential(from, to, t, exponent = 2) {
        // Exponential curve: eases in/out
        const easedT = Math.pow(t, exponent);
        return from + (to - from) * easedT;
    }

    /**
     * Logarithmic interpolation (smooth deceleration)
     * 
     * @param {number} from - Start value
     * @param {number} to - End value
     * @param {number} t - Progress (0-1)
     * @param {number} base - Logarithm base (default: 10)
     * @returns {number} Interpolated value
     */
    static logarithmic(from, to, t, base = 10) {
        // Logarithmic curve: fast start, slow end
        if (t <= 0) return from;
        if (t >= 1) return to;
        
        const logT = Math.log(1 + (base - 1) * t) / Math.log(base);
        return from + (to - from) * logT;
    }

    /**
     * Bezier curve interpolation (smooth S-curve)
     * 
     * @param {number} from - Start value
     * @param {number} to - End value
     * @param {number} t - Progress (0-1)
     * @param {number} control1 - First control point (0-1, default: 0.25)
     * @param {number} control2 - Second control point (0-1, default: 0.75)
     * @returns {number} Interpolated value
     */
    static bezier(from, to, t, control1 = 0.25, control2 = 0.75) {
        // Cubic bezier curve (ease-in-out)
        // Uses standard bezier formula: P(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
        // Simplified for value interpolation with control points
        
        // Ease-in-out bezier (standard S-curve)
        const t2 = t * t;
        const t3 = t2 * t;
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;
        
        // Standard ease-in-out bezier curve
        const easedT = 3 * mt2 * t + 3 * mt * t2 + t3;
        return from + (to - from) * easedT;
    }

    /**
     * Cubic spline interpolation (smooth curve with continuous derivatives)
     * 
     * @param {number} from - Start value
     * @param {number} to - End value
     * @param {number} t - Progress (0-1)
     * @param {number} fromDerivative - Start derivative (slope, default: 0)
     * @param {number} toDerivative - End derivative (slope, default: 0)
     * @returns {number} Interpolated value
     */
    static cubic(from, to, t, fromDerivative = 0, toDerivative = 0) {
        // Cubic Hermite spline interpolation
        const t2 = t * t;
        const t3 = t2 * t;
        
        const h1 = 2 * t3 - 3 * t2 + 1; // Hermite basis function 1
        const h2 = -2 * t3 + 3 * t2;     // Hermite basis function 2
        const h3 = t3 - 2 * t2 + t;      // Hermite basis function 3
        const h4 = t3 - t2;              // Hermite basis function 4
        
        return h1 * from + h2 * to + h3 * fromDerivative + h4 * toDerivative;
    }

    /**
     * Step interpolation (no interpolation, step-wise)
     * 
     * @param {number} from - Start value
     * @param {number} to - End value
     * @param {number} t - Progress (0-1)
     * @returns {number} Start value (no interpolation)
     */
    static step(from, to, t) {
        return t < 1 ? from : to;
    }

    /**
     * Ease-in-out interpolation (smooth acceleration and deceleration)
     * 
     * @param {number} from - Start value
     * @param {number} to - End value
     * @param {number} t - Progress (0-1)
     * @returns {number} Interpolated value
     */
    static easeInOut(from, to, t) {
        // Ease-in-out using sine function
        const easedT = -(Math.cos(Math.PI * t) - 1) / 2;
        return from + (to - from) * easedT;
    }

    /**
     * Ease-in interpolation (smooth acceleration)
     * 
     * @param {number} from - Start value
     * @param {number} to - End value
     * @param {number} t - Progress (0-1)
     * @returns {number} Interpolated value
     */
    static easeIn(from, to, t) {
        const easedT = 1 - Math.cos((t * Math.PI) / 2);
        return from + (to - from) * easedT;
    }

    /**
     * Ease-out interpolation (smooth deceleration)
     * 
     * @param {number} from - Start value
     * @param {number} to - End value
     * @param {number} t - Progress (0-1)
     * @returns {number} Interpolated value
     */
    static easeOut(from, to, t) {
        const easedT = Math.sin((t * Math.PI) / 2);
        return from + (to - from) * easedT;
    }

    /**
     * Interpolate between two values using specified method
     * 
     * @param {number} from - Start value
     * @param {number} to - End value
     * @param {number} t - Progress (0-1)
     * @param {string} method - Interpolation method ('linear', 'exponential', 'logarithmic', 'bezier', 'cubic', 'step', 'easeInOut', 'easeIn', 'easeOut')
     * @param {Object} options - Additional options for interpolation
     * @returns {number} Interpolated value
     */
    static interpolate(from, to, t, method = 'linear', options = {}) {
        // Clamp t to [0, 1]
        t = Math.max(0, Math.min(1, t));

        switch (method.toLowerCase()) {
            case 'linear':
                return this.linear(from, to, t);
            
            case 'exponential':
                return this.exponential(from, to, t, options.exponent || 2);
            
            case 'logarithmic':
                return this.logarithmic(from, to, t, options.base || 10);
            
            case 'bezier':
                return this.bezier(
                    from,
                    to,
                    t,
                    options.control1 || 0.25,
                    options.control2 || 0.75
                );
            
            case 'cubic':
                return this.cubic(
                    from,
                    to,
                    t,
                    options.fromDerivative || 0,
                    options.toDerivative || 0
                );
            
            case 'step':
            case 'none':
                return this.step(from, to, t);
            
            case 'easeinout':
                return this.easeInOut(from, to, t);
            
            case 'easein':
                return this.easeIn(from, to, t);
            
            case 'easeout':
                return this.easeOut(from, to, t);
            
            default:
                console.warn(`AutomationInterpolation: Unknown method "${method}", using linear`);
                return this.linear(from, to, t);
        }
    }

    /**
     * Get available interpolation methods
     * 
     * @returns {Array<string>} Array of available method names
     */
    static getAvailableMethods() {
        return [
            'linear',
            'exponential',
            'logarithmic',
            'bezier',
            'cubic',
            'step',
            'easeInOut',
            'easeIn',
            'easeOut'
        ];
    }

    /**
     * Validate interpolation method
     * 
     * @param {string} method - Method name to validate
     * @returns {boolean} True if method is valid
     */
    static isValidMethod(method) {
        return this.getAvailableMethods().includes(method.toLowerCase());
    }
}

/**
 * Helper function for easy import
 * 
 * @param {number} from - Start value
 * @param {number} to - End value
 * @param {number} t - Progress (0-1)
 * @param {string} method - Interpolation method
 * @param {Object} options - Additional options
 * @returns {number} Interpolated value
 */
export function interpolateAutomation(from, to, t, method = 'linear', options = {}) {
    return AutomationInterpolation.interpolate(from, to, t, method, options);
}

