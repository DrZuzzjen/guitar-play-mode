# Ultimate Guitar Content Extraction - Technical Analysis

## Overview

Ultimate Guitar (UG) uses a React-based SPA with complex DOM structures that vary between pages. This document details the findings from debugging the "blank screen" issue on modern UG pages.

## Page Structure Findings (November 2025)

### DOM Structure on Modern Pages (e.g., "Wish You Were Here")

```html
<code>
  <pre class="xNWlr yoh_z PBFx0" style="font-size: 13px;">
    <!-- 335 childNodes: text nodes, spans for chords -->
    <!-- 1 children: a UI div -->
    [Intro]
    e|-----3---...
    <span>C</span>
    ...
    <div class="vxv2A">X</div>  <!-- UI close button -->
  </pre>
</code>
```

**Key metrics:**
- `document.querySelector('code > pre').children.length` = **1** (single DIV child element)
- `document.querySelector('code > pre').childNodes.length` = **335** (text nodes, spans, etc.)
- Content length: ~6564 characters

### Data Storage Locations

| Location | Availability | Content |
|----------|--------------|---------|
| `window.UGAPP.store.page.data.tab_view.wiki_tab.content` | ✅ Available in page context | Raw tab content with `[ch]G[/ch]` markup |
| `.js-store[data-content]` | ❌ Not present on tested pages | N/A |
| `<code><pre>` DOM element | ✅ Available | Rendered HTML with obfuscated classes |

**Important:** Content scripts cannot access `window.UGAPP` due to JavaScript context isolation. The DOM `<code><pre>` element is the only reliable extraction source.

## The Bug: Blank Screen on Modern Pages (FIXED)

### Symptoms
- Legacy pages (e.g., "House of the Rising Sun") worked correctly
- Modern pages (e.g., "Wish You Were Here") showed blank overlay with only toolbar

### Root Cause

**Two bugs in `content.js` → `prepareBlocks()`:**

#### Bug 1: Incorrect PRE detection logic

```javascript
// OLD CODE (BROKEN)
let targetNode = root;
const pre = root.querySelector('pre');  // If root IS the PRE, this returns null!
if (pre) {
    targetNode = pre;
} else {
    // Drill down - THIS RAN INCORRECTLY when root was already PRE
    while (targetNode.children.length === 1 && ['DIV', 'SECTION'].includes(targetNode.firstElementChild.tagName)) {
         targetNode = targetNode.firstElementChild;
    }
}
```

When `root` IS the `<pre>` element:
1. `root.querySelector('pre')` searches INSIDE and returns `null`
2. Falls to else branch
3. PRE has 1 child (UI DIV), so drill-down condition is true
4. `targetNode` becomes the UI DIV instead of the PRE
5. All content is lost

#### Bug 2: UI DIVs inside PRE

UG injects `<div class="vxv2A">X</div>` inside the PRE for UI controls, which confused the block-detection logic.

### The Fix

```javascript
// NEW CODE (FIXED)
let targetNode = root;

if (root.tagName === 'PRE') {
    // Root is already the PRE, use it directly
    targetNode = root;
} else {
    // Look for PRE inside
    const pre = root.querySelector('pre');
    if (pre) {
        targetNode = pre;
    } else {
        // Fallback: Drill down...
    }
}

// Strip UI elements from PRE
if (targetNode.tagName === 'PRE') {
    Array.from(targetNode.querySelectorAll('div')).forEach(div => {
        if (div.textContent.trim().length <= 2) {
            div.remove();
        }
    });
}
```

## Extraction Strategy

The adapter (`ultimate-guitar.js`) tries methods in this order:

1. `findCodeBlockPre()` - Selector `code > pre` ✅ **Primary method**
2. `findLargestPre()` - Largest PRE by text length ✅ Fallback
3. `findDataAttributePre()` - `[data-name="tab-content"]` ⚠️ Legacy
4. `findJsTabContentPre()` - `.js-tab-content` ⚠️ Legacy

## Test URLs

| URL | Type | Status |
|-----|------|--------|
| https://tabs.ultimate-guitar.com/tab/the-animals/house-of-the-rising-sun-chords-18688 | Legacy | ✅ Works |
| https://tabs.ultimate-guitar.com/tab/pink-floyd/wish-you-were-here-tabs-104578 | Modern (Tabs) | ✅ Fixed |
| https://tabs.ultimate-guitar.com/tab/pink-floyd/wish-you-were-here-chords-44555 | Modern (Chords) | ✅ Fixed |

## Debugging Commands

Quick diagnostics to run in browser console:

```javascript
// Check if PRE exists and its structure
document.querySelector('code > pre')?.textContent.length
document.querySelector('code > pre')?.children.length
document.querySelector('code > pre')?.childNodes.length

// Check what's rendered in the overlay (after activation)
document.querySelector('#gpm-content')?.firstElementChild?.tagName
document.querySelector('#gpm-content')?.innerHTML.length
```

## Lessons Learned

1. **`element.querySelector()` searches descendants, not self** - If checking whether an element IS a certain tag, use `element.tagName` directly
2. **Mixed content in PRE** - Modern sites inject UI elements inside semantic tags; always sanitize
3. **Content script isolation** - Cannot access page's JavaScript globals (`window.UGAPP`); must use DOM
