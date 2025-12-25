/**
 * Velocity Curve Utilities
 * Provides different velocity response curves for more musical expression
 */

export const VelocityCurveType = {
    LINEAR: 'linear',
    EXPONENTIAL: 'exponential',
    LOGARITHMIC: 'logarithmic',
    S_CURVE: 's-curve',
    CUSTOM: 'custom'
};

export class VelocityCurve {
    /**
     * Linear curve (1:1 mapping)
     * @param {number} velocity - Input velocity (0-127)
     * @returns {number} - Mapped velocity (0-127)
     */
    static linear(velocity) {
        return velocity;
    }

    /**
     * Exponential curve (more sensitive at soft velocities)
     * @param {number} velocity - Input velocity (0-127)
     * @param {number} power - Curve power (default: 2)
     * @returns {number} - Mapped velocity (0-127)
     */
    static exponential(velocity, power = 2) {
        const normalized = velocity / 127;
        const curved = Math.pow(normalized, power);
        return Math.round(curved * 127);
    }

    /**
     * Logarithmic curve (more sensitive at loud velocities)
     * @param {number} velocity - Input velocity (0-127)
     * @returns {number} - Mapped velocity (0-127)
     */
    static logarithmic(velocity) {
        if (velocity === 0) return 0;
        const normalized = Math.log(velocity + 1) / Math.log(128);
        return Math.round(normalized * 127);
    }

    /**
     * S-Curve (smooth step, linear in middle, soft at extremes)
     * @param {number} velocity - Input velocity (0-127)
     * @returns {number} - Mapped velocity (0-127)
     */
    static sCurve(velocity) {
        const x = velocity / 127;
        const curved = x * x * (3 - 2 * x); // Smoothstep function
        return Math.round(curved * 127);
    }

    /**
     * Custom curve using interpolation points
     * @param {number} velocity - Input velocity (0-127)
     * @param {Array} points - Array of {velocity, output} points
     * @returns {number} - Mapped velocity (0-127)
     */
    static custom(velocity, points = []) {
        if (points.length === 0) {
            return velocity; // Fallback to linear
        }

        // Sort points by velocity
        const sortedPoints = [...points].sort((a, b) => a.velocity - b.velocity);

        // Find surrounding points
        let lowerPoint = sortedPoints[0];
        let upperPoint = sortedPoints[sortedPoints.length - 1];

        for (let i = 0; i < sortedPoints.length - 1; i++) {
            if (velocity >= sortedPoints[i].velocity && velocity <= sortedPoints[i + 1].velocity) {
                lowerPoint = sortedPoints[i];
                upperPoint = sortedPoints[i + 1];
                break;
            }
        }

        // Linear interpolation between points
        if (lowerPoint.velocity === upperPoint.velocity) {
            return lowerPoint.output;
        }

        const t = (velocity - lowerPoint.velocity) / (upperPoint.velocity - lowerPoint.velocity);
        const output = lowerPoint.output + t * (upperPoint.output - lowerPoint.output);

        return Math.round(Math.max(0, Math.min(127, output)));
    }

    /**
     * Apply velocity curve
     * @param {number} velocity - Input velocity (0-127)
     * @param {string} curveType - Curve type from VelocityCurveType
     * @param {Object} options - Additional options (power, points, etc.)
     * @returns {number} - Mapped velocity (0-127)
     */
    static apply(velocity, curveType = VelocityCurveType.LINEAR, options = {}) {
        switch (curveType) {
            case VelocityCurveType.LINEAR:
                return this.linear(velocity);

            case VelocityCurveType.EXPONENTIAL:
                return this.exponential(velocity, options.power || 2);

            case VelocityCurveType.LOGARITHMIC:
                return this.logarithmic(velocity);

            case VelocityCurveType.S_CURVE:
                return this.sCurve(velocity);

            case VelocityCurveType.CUSTOM:
                return this.custom(velocity, options.points || []);

            default:
                console.warn(`Unknown velocity curve type: ${curveType}, using linear`);
                return this.linear(velocity);
        }
    }

    /**
     * Get curve visualization data for UI
     * @param {string} curveType - Curve type
     * @param {Object} options - Curve options
     * @param {number} steps - Number of points to generate (default: 128)
     * @returns {Array} - Array of {input, output} points
     */
    static getVisualizationData(curveType, options = {}, steps = 128) {
        const data = [];

        for (let i = 0; i < steps; i++) {
            const input = Math.round((i / (steps - 1)) * 127);
            const output = this.apply(input, curveType, options);
            data.push({ input, output });
        }

        return data;
    }
}

/**
 * Velocity sensitivity presets
 */
export const VelocityPresets = {
    // Very soft playing style
    SOFT: {
        type: VelocityCurveType.EXPONENTIAL,
        power: 1.5,
        description: 'More sensitive to soft playing'
    },

    // Normal/Linear
    NORMAL: {
        type: VelocityCurveType.LINEAR,
        description: 'Linear 1:1 mapping'
    },

    // Hard playing style
    HARD: {
        type: VelocityCurveType.LOGARITHMIC,
        description: 'More sensitive to hard playing'
    },

    // Smooth transitions
    SMOOTH: {
        type: VelocityCurveType.S_CURVE,
        description: 'Smooth transitions, gentle at extremes'
    },

    // Very expressive (high dynamic range)
    EXPRESSIVE: {
        type: VelocityCurveType.EXPONENTIAL,
        power: 2.5,
        description: 'Very expressive, wide dynamic range'
    },

    // Compressed (narrow dynamic range)
    COMPRESSED: {
        type: VelocityCurveType.EXPONENTIAL,
        power: 0.5,
        description: 'Compressed dynamic range'
    }
};
