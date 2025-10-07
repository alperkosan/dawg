/**
 * TOOL FACTORY
 *
 * Creates and manages tool instances
 */

import { PaintBrushTool } from './tools/PaintBrushTool';
import { ChopperTool } from './tools/ChopperTool';
import { StrumizerTool } from './tools/StrumizerTool';
import { ArpeggiatorTool } from './tools/ArpeggiatorTool';
import { FlamTool } from './tools/FlamTool';
import { RandomizerTool } from './tools/RandomizerTool';
import { FlipTool } from './tools/FlipTool';
import { TOOL_TYPES } from './PianoRollToolManager';

export class ToolFactory {
  static createTool(toolType, settings) {
    switch (toolType) {
      case TOOL_TYPES.PAINT_BRUSH:
        return new PaintBrushTool(settings);

      case TOOL_TYPES.CHOPPER:
        return new ChopperTool(settings);

      case TOOL_TYPES.STRUMIZER:
        return new StrumizerTool(settings);

      case TOOL_TYPES.ARPEGGIATOR:
        return new ArpeggiatorTool(settings);

      case TOOL_TYPES.FLAM:
        return new FlamTool(settings);

      case TOOL_TYPES.RANDOMIZER:
        return new RandomizerTool(settings);

      case TOOL_TYPES.FLIP:
        return new FlipTool(settings);

      case TOOL_TYPES.SELECT:
      case TOOL_TYPES.ERASER:
        // These tools don't need instances, handled by piano roll directly
        return null;

      default:
        console.warn('Unknown tool type:', toolType);
        return null;
    }
  }
}

export default ToolFactory;
