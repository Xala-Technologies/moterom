# Optional private floor plan

The customer's building floor-plan image is deliberately excluded from this repository. It was not approved for upload by automatic review.

If the building owner authorizes displaying it, mount an approved PNG on the server and set `FLOORPLAN_PATH` to its absolute path. The application shows the floor-plan control only when the file exists and serves it through the same public/member access gate as the room catalogue. Choose `BOOKING_ACCESS=members` if the image must require tenant membership in this portal.

For local development, `assets/floor-plan.png` is also supported and is gitignored. The Docker build excludes it. Do not commit private building plans into source control without explicit approval.
