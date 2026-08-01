/*!
 * Wheel Of Destiny
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Pings a token's position and pulls every connected client's view to it.
 *
 * Shared by `WoD#panAndPingToken` (the draw result) and the picker's per-row locate
 * button — kept here rather than imported between those two modules so neither has to
 * depend on the other.
 * @param {Token} token
 * @returns {void}
 */
export function pingToken(token) {
  canvas.ping(token.center, {
    scene: canvas.scene.id,
    pull: true,
    style: CONFIG.Canvas.pings.types.PULL
  });
}
