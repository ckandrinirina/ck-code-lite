// figma-mock.mjs — a loopback stand-in for api.figma.com, for the smoke test of `replicate figma pull`.
// Usage: node figma-mock.mjs <seconds>  → prints the port, serves for that long. API calls need the
// X-Figma-Token header; asset downloads refuse it (the token must never leave for an asset host).
// Keep byte-identical in ck-code/tests and ck-code-lite/tests.
import { createServer } from 'node:http';
import { deflateSync } from 'node:zlib';
const DOC = {"id": "1:2", "name": "Settings", "type": "FRAME", "absoluteBoundingBox": {"x": 100, "y": 50, "width": 400, "height": 300}, "fills": [{"type": "SOLID", "color": {"r": 1, "g": 1, "b": 1, "a": 1}}], "cornerRadius": 12, "clipsContent": true, "effects": [{"type": "DROP_SHADOW", "visible": true, "color": {"r": 0, "g": 0, "b": 0, "a": 0.1}, "offset": {"x": 0, "y": 4}, "radius": 12, "spread": 0}], "layoutMode": "VERTICAL", "itemSpacing": 16, "paddingTop": 24, "paddingRight": 24, "paddingBottom": 24, "paddingLeft": 24, "primaryAxisAlignItems": "MIN", "counterAxisAlignItems": "MIN", "children": [{"id": "1:3", "name": "Title", "type": "TEXT", "absoluteBoundingBox": {"x": 124, "y": 74, "width": 352, "height": 28}, "layoutSizingHorizontal": "FILL", "layoutSizingVertical": "HUG", "characters": "Account settings", "style": {"fontFamily": "Inter", "fontWeight": 600, "fontSize": 20, "lineHeightPx": 28, "lineHeightUnit": "PIXELS", "letterSpacing": -0.2, "textAlignHorizontal": "LEFT", "textAutoResize": "HEIGHT"}, "characterStyleOverrides": [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1], "styleOverrideTable": {"1": {"fontWeight": 400, "fills": [{"type": "SOLID", "color": {"r": 0.4, "g": 0.4, "b": 0.4, "a": 1}}]}}, "fills": [{"type": "SOLID", "color": {"r": 0.067, "g": 0.094, "b": 0.153, "a": 1}}], "styles": {"text": "S:1"}}, {"id": "1:4", "name": "Row", "type": "FRAME", "absoluteBoundingBox": {"x": 124, "y": 118, "width": 352, "height": 40}, "layoutMode": "HORIZONTAL", "itemSpacing": 8, "primaryAxisAlignItems": "SPACE_BETWEEN", "counterAxisAlignItems": "CENTER", "layoutSizingHorizontal": "FILL", "layoutSizingVertical": "FIXED", "fills": [], "strokes": [{"type": "SOLID", "color": {"r": 0.9, "g": 0.91, "b": 0.92, "a": 1}}], "strokeWeight": 1, "individualStrokeWeights": {"top": 0, "right": 0, "bottom": 1, "left": 0}, "strokeAlign": "INSIDE", "children": [{"id": "1:5", "name": "Icon/gear", "type": "INSTANCE", "componentId": "9:1", "absoluteBoundingBox": {"x": 124, "y": 128, "width": 20, "height": 20}, "absoluteRenderBounds": {"x": 125, "y": 129, "width": 18, "height": 18}, "layoutSizingHorizontal": "FIXED", "layoutSizingVertical": "FIXED", "children": [{"id": "I1:5;2:1", "name": "Vector", "type": "VECTOR", "absoluteBoundingBox": {"x": 125, "y": 129, "width": 18, "height": 18}, "fills": [{"type": "SOLID", "color": {"r": 0, "g": 0, "b": 0, "a": 1}}]}]}, {"id": "1:6", "name": "Button", "type": "INSTANCE", "componentId": "9:2", "absoluteBoundingBox": {"x": 380, "y": 122, "width": 96, "height": 32}, "layoutMode": "HORIZONTAL", "paddingLeft": 16, "paddingRight": 16, "paddingTop": 6, "paddingBottom": 6, "primaryAxisAlignItems": "CENTER", "counterAxisAlignItems": "CENTER", "layoutSizingHorizontal": "HUG", "layoutSizingVertical": "HUG", "fills": [{"type": "GRADIENT_LINEAR", "gradientHandlePositions": [{"x": 0, "y": 0.5}, {"x": 1, "y": 0.5}, {"x": 0, "y": 1}], "gradientStops": [{"color": {"r": 0.23, "g": 0.36, "b": 0.86, "a": 1}, "position": 0}, {"color": {"r": 0.4, "g": 0.2, "b": 0.9, "a": 1}, "position": 1}]}], "cornerRadius": 8, "children": [{"id": "1:7", "name": "Label", "type": "TEXT", "absoluteBoundingBox": {"x": 396, "y": 128, "width": 64, "height": 20}, "characters": "Save", "style": {"fontFamily": "Inter", "fontWeight": 500, "fontSize": 14, "lineHeightPx": 20, "lineHeightUnit": "PIXELS", "textAlignHorizontal": "CENTER", "textAutoResize": "WIDTH_AND_HEIGHT", "textCase": "UPPER"}, "fills": [{"type": "SOLID", "color": {"r": 1, "g": 1, "b": 1, "a": 1}}], "layoutSizingHorizontal": "HUG", "layoutSizingVertical": "HUG"}]}]}, {"id": "1:8", "name": "Avatar", "type": "ELLIPSE", "absoluteBoundingBox": {"x": 124, "y": 174, "width": 48, "height": 48}, "layoutSizingHorizontal": "FIXED", "layoutSizingVertical": "FIXED", "fills": [{"type": "IMAGE", "imageRef": "abc123", "scaleMode": "FILL"}]}, {"id": "1:9", "name": "Badge", "type": "RECTANGLE", "layoutPositioning": "ABSOLUTE", "absoluteBoundingBox": {"x": 460, "y": 60, "width": 30, "height": 16}, "fills": [{"type": "SOLID", "color": {"r": 1, "g": 0, "b": 0, "a": 1}, "opacity": 0.5}], "rectangleCornerRadii": [8, 8, 8, 0]}, {"id": "1:10", "name": "Hidden", "type": "RECTANGLE", "visible": false, "absoluteBoundingBox": {"x": 0, "y": 0, "width": 1, "height": 1}}]};
const T = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (b) => { let c = -1; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const ch = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function png(w, h) {
  const raw = Buffer.alloc(h * (w * 4 + 1), 255);
  for (let y = 0; y < h; y++) raw[y * (w * 4 + 1)] = 0;
  const hd = Buffer.alloc(13); hd.writeUInt32BE(w, 0); hd.writeUInt32BE(h, 4); hd[8] = 8; hd[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ch('IHDR', hd), ch('IDAT', deflateSync(raw)), ch('IEND', Buffer.alloc(0))]);
}
let base = '';
const json = (res, v, code = 200) => res.writeHead(code, { 'content-type': 'application/json' }).end(JSON.stringify(v));
const srv = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const tok = req.headers['x-figma-token'];
  if (u.pathname.startsWith('/asset/')) {
    if (tok) return res.writeHead(400).end('token sent to an asset host');
    if (u.pathname.endsWith('.svg')) return res.writeHead(200).end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18"><circle cx="9" cy="9" r="8"/></svg>');
    return res.writeHead(200).end(png(u.pathname.includes('frame') ? 400 : 2, u.pathname.includes('frame') ? 300 : 2));
  }
  if (!tok || !tok.startsWith('figd_')) return json(res, { status: 403, err: 'no token' }, 403);
  const p = u.pathname;
  if (p === '/v1/files/AbCdEfGhIjKlMnOp') return json(res, { name: 'Mock App', version: 'v1', lastModified: '2026-11-19T00:00:00Z', document: { id: '0:0', type: 'DOCUMENT', children: [{ id: '0:1', name: 'Screens', type: 'CANVAS', children: [{ id: DOC.id, name: DOC.name, type: DOC.type }] }] } });
  if (p === '/v1/files/AbCdEfGhIjKlMnOp/nodes') return json(res, { nodes: { [DOC.id]: { document: DOC, components: { '9:1': { name: 'Icon/gear' }, '9:2': { name: 'Size=md', componentSetId: '8:1' } }, componentSets: { '8:1': { name: 'Button' } }, styles: { 'S:1': { name: 'Heading/H2', styleType: 'TEXT' } } } } });
  if (p === '/v1/images/AbCdEfGhIjKlMnOp') {
    const ids = (u.searchParams.get('ids') || '').split(',');
    const svg = u.searchParams.get('format') === 'svg';
    return json(res, { images: Object.fromEntries(ids.map((id) => [id, `${base}/asset/${svg ? 'v' : 'frame'}-${id.replace(/\W/g, '_')}.${svg ? 'svg' : 'png'}`])) });
  }
  if (p === '/v1/files/AbCdEfGhIjKlMnOp/images') return json(res, { meta: { images: { abc123: `${base}/asset/img-abc123.png` } } });
  if (p === '/v1/files/AbCdEfGhIjKlMnOp/variables/local') return json(res, { status: 403, err: 'Enterprise only' }, 403);
  json(res, { status: 404 }, 404);
});
srv.listen(0, '127.0.0.1', () => { base = `http://127.0.0.1:${srv.address().port}`; console.log(srv.address().port); });
setTimeout(() => process.exit(0), (+process.argv[2] || 20) * 1000);
