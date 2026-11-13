package ua.blackout.prewarning.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.graphics.graphicsLayer

/** One full turn of a busy icon (the web simulator uses Tailwind `animate-spin`, also 1 s). */
private const val SPIN_TURN_MS = 1000

/**
 * Rotates the element clockwise, one turn per second, while [active] is true. When the work ends the
 * current turn finishes and the icon stops upright, so it never freezes at an odd angle.
 */
fun Modifier.spinWhile(active: Boolean): Modifier = composed {
    val angle = remember { Animatable(0f) }
    LaunchedEffect(active) {
        if (active) {
            while (true) {
                angle.animateTo(360f, tween(((360f - angle.value) / 360f * SPIN_TURN_MS).toInt().coerceAtLeast(1), easing = LinearEasing))
                angle.snapTo(0f)
            }
        } else if (angle.value != 0f) {
            angle.animateTo(360f, tween(((360f - angle.value) / 360f * SPIN_TURN_MS).toInt().coerceAtLeast(1), easing = LinearEasing))
            angle.snapTo(0f)
        }
    }
    graphicsLayer { rotationZ = angle.value }
}
