import { vec3 } from "gl-matrix";

export const clamp = (a: number, b: number, c: number) => {
    return Math.max(b, Math.min(c, a));
};

export const clampVec3 = (a: vec3, b: vec3, c: vec3) => {
    a[0] = clamp(a[0], b[0], c[0]);
    a[1] = clamp(a[1], b[1], c[1]);
    a[2] = clamp(a[2], b[2], c[2]);
};

export const negVec3 = (a: vec3) => {
    return vec3.fromValues(-a[0], -a[1], -a[2]);
};
