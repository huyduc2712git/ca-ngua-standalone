# Tài sản đồ họa bản 2.1

- `dist/assets/walnut.png`: một texture gỗ gốc được tạo bằng built-in imagegen, 1254 × 1254 PNG, dùng cho nền bàn, khung gỗ và lớp vật liệu trong WebGL. Đã lưu trong gói standalone và nhúng vào host độc lập. Không tải qua CDN.
- Ảnh Ludo đính kèm của người dùng chỉ làm tham khảo thiết kế. Không chỉnh sửa hoặc phân phối ảnh đó trong gói game.
- `dist/board-art.mjs` tạo mặt bàn bằng tọa độ từ luật; đây là mã giao diện, không phải ảnh bàn cờ do AI suy đoán đường đi.
- `dist/geometry.mjs` dựng quân tròn bằng phép quay biên dạng, có đánh số; bộ hình học ngựa từ bản trước vẫn kèm mã nguồn và thông báo giấy phép.

## Prompt texture đã dùng

Use case: photorealistic-natural
Asset type: square seamless wood diffuse/albedo material texture for the repeating tabletop background and wooden board frame of a cozy WebGL Ludo game.
Primary request: Generate exactly one original square 1024x1024 warm medium-dark walnut wood surface texture, seamlessly tileable on all four edges.
Composition/framing: flat top-down orthographic scan, wood surface fills the entire image edge-to-edge, fine flowing walnut grain running mostly left to right, restrained natural variation without conspicuous knots or patterns.
Lighting/mood: completely even neutral illumination; diffuse albedo only with no baked lighting, no shadows, no reflections, no bright spots, no vignette.
Color palette: rich warm brown centered around #5a351e, subtle cocoa and muted golden-brown grain; avoid red or orange cast.
Materials/textures: subtle handcrafted walnut with a gently polished but matte finish, detailed fine grain and smooth surface, low contrast enough to remain quiet beneath a game board.
Constraints: one uninterrupted wood surface; seamless repeat at left/right and top/bottom boundaries. No objects, plank gaps, cracks, joints, seams, borders, perspective, board grid, letters, numbers, text, logos, watermarks, game pieces, gloss or specular highlights.
