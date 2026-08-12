import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

def strip_checkerboard(src_path, dst_path, sat_thresh=34):
    im = Image.open(src_path).convert("RGB")
    arr = np.asarray(im).astype(np.int16)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = mx - mn
    is_grayish = sat <= sat_thresh

    # erode first to sever thin 1-2px leak paths through JPEG-blurred outline gaps,
    # label/flood-fill from the border on the eroded mask, then dilate the resulting
    # background region back out (clipped to the original mask) to restore its true extent
    eroded = ndimage.binary_erosion(is_grayish, iterations=2, border_value=1)
    labels, n = ndimage.label(eroded, structure=np.ones((3, 3)))
    m = 6  # margin band: erosion always kills the literal edge pixels, so sample a few px in
    border_labels = (
        set(labels[0:m, :].ravel()) | set(labels[-m:, :].ravel())
        | set(labels[:, 0:m].ravel()) | set(labels[:, -m:].ravel())
    )
    border_labels.discard(0)
    core_bg = np.isin(labels, list(border_labels))

    bg_mask = ndimage.binary_dilation(core_bg, iterations=3) & is_grayish

    alpha = np.where(bg_mask, 0, 255).astype(np.uint8)
    alpha_img = Image.fromarray(alpha, mode="L")
    # feather the cutout edge slightly so it doesn't look hard-clipped
    alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(1.0))
    # re-binarize the feather's outer fringe back toward 0/255 but keep a soft ramp
    alpha_arr = np.asarray(alpha_img).astype(np.uint8)

    rgba = np.dstack([np.asarray(im), alpha_arr])
    out = Image.fromarray(rgba, mode="RGBA")
    out.save(dst_path)
    removed_pct = 100.0 * bg_mask.sum() / bg_mask.size
    print(f"{src_path} -> {dst_path}  bg_removed={removed_pct:.1f}%  components={n}")

if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    strip_checkerboard(src, dst)
