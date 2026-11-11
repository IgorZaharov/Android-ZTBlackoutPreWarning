package ua.blackout.prewarning.ui.components

import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Custom floating shadow modifier that draws a genuine hardware-accelerated
 * multi-step Gaussian drop-shadow behind the composable, matching the Web
 * workbench shadow-[0_16px_44px_rgba(0,0,0,0.55)].
 *
 * This renders reliably on all real physical devices and GPUs without depending
 * on unsupported platform mask filters that are ignored by Android HWUI/Skia.
 */
fun Modifier.floatingShadow(
    color: Color = Color(0xB3000000),
    borderRadius: Dp = 24.dp,
    blurRadius: Dp = 22.dp,
    offsetY: Dp = 8.dp,
    spread: Dp = 2.dp
): Modifier = this.drawBehind {
    val blurPx = blurRadius.toPx()
    val offsetYPx = offsetY.toPx()
    val spreadPx = spread.toPx()
    val cornerPx = borderRadius.toPx()

    if (blurPx <= 0f && spreadPx <= 0f) return@drawBehind

    val steps = 18
    val baseAlpha = color.alpha

    for (step in steps downTo 1) {
        val t = step.toFloat() / steps.toFloat() // 1.0 down to ~0.055
        val progress = t * t // Quadratic curve creates smooth Gaussian density

        val expandX = spreadPx + blurPx * progress
        val topExpand = (spreadPx + blurPx * progress * 0.45f - offsetYPx * progress * 0.45f).coerceAtLeast(0f)
        val bottomExpand = spreadPx + blurPx * progress + offsetYPx * progress

        val currentCornerRadius = (cornerPx + expandX * 0.5f).coerceAtLeast(0f)
        val falloff = (1f - progress).coerceIn(0f, 1f)
        val stepAlpha = (baseAlpha / steps) * (0.6f + 1.2f * falloff)

        if (stepAlpha > 0.003f) {
            drawRoundRect(
                color = color.copy(alpha = stepAlpha.coerceIn(0f, 1f)),
                topLeft = Offset(-expandX, -topExpand),
                size = Size(
                    width = size.width + 2f * expandX,
                    height = size.height + topExpand + bottomExpand
                ),
                cornerRadius = CornerRadius(currentCornerRadius, currentCornerRadius)
            )
        }
    }
}
