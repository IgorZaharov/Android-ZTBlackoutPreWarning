package ua.blackout.prewarning.ui.components

import android.graphics.BlurMaskFilter
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Custom floating shadow modifier that draws a genuine blurred Gaussian drop-shadow
 * behind the composable, matching the Web workbench shadow-[0_16px_44px_rgba(0,0,0,0.55)].
 * Unlike standard Modifier.shadow(), this works reliably on dark/translucent backgrounds,
 * avoids RenderNode elevation clipping inside scrollable containers, and creates visible depth.
 */
fun Modifier.floatingShadow(
    color: Color = Color(0x8C000000),
    borderRadius: Dp = 24.dp,
    blurRadius: Dp = 20.dp,
    offsetY: Dp = 8.dp,
    spread: Dp = 2.dp
): Modifier = this.drawBehind {
    drawIntoCanvas { canvas ->
        val paint = Paint().asFrameworkPaint().apply {
            isAntiAlias = true
            this.color = color.toArgb()
            if (blurRadius > 0.dp) {
                maskFilter = BlurMaskFilter(blurRadius.toPx(), BlurMaskFilter.Blur.NORMAL)
            }
        }

        val spreadPx = spread.toPx()
        val left = -spreadPx
        val top = offsetY.toPx() - spreadPx
        val right = size.width + spreadPx
        val bottom = size.height + offsetY.toPx() + spreadPx
        val radiusPx = (borderRadius + spread).toPx()

        canvas.drawRoundRect(
            left,
            top,
            right,
            bottom,
            radiusPx,
            radiusPx,
            paint
        )
    }
}
