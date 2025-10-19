# Quick Fix: Sticky Canvas Positioning

**Issue**: Dark areas appearing, canvas not covering viewport
**Solution**: Use `position: sticky` to keep canvas fixed to viewport while scrolling

## Changes Made

### UnifiedGridContainer.jsx

Changed canvas container from `position: absolute` to `position: sticky`:

```jsx
// Canvas container
<div style={{
  position: 'sticky',  // ← Changed from 'absolute'
  top: 0,
  left: 0,
  zIndex: 10,
  width: `${viewportWidth}px`,
  height: `${viewportHeight}px`,
}}>
  <UnifiedGridCanvas ... />
</div>
```

## How It Works

**Position: Sticky** = Best of both worlds:
- Acts like `relative` until scroll position reached
- Then acts like `fixed` within parent
- Stays visible in viewport while parent scrolls
- Automatically covers the visible area

## Expected Behavior

✅ Canvas covers entire viewport (no dark areas)
✅ Canvas scrolls with content (stays aligned)
✅ Grid lines match instrument rows
✅ Notes stay in correct positions

## Test Now

1. Refresh browser
2. Check if dark areas gone
3. Scroll - canvas should stay visible
4. Grid lines should align with rows

If still issues, we may need to adjust z-index or positioning further.
