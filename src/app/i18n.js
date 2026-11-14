/**
 * WordPress's translation functions, in one place, so the build keeps their names (__, _n, sprintf) and WordPress's
 * translation tools find every string in assets/build/app.js.
 */
export const { __, _n, sprintf } = wp.i18n;
