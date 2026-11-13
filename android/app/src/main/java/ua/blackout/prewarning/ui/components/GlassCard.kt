package ua.blackout.prewarning.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import ua.blackout.prewarning.ui.theme.ZtColors
import ua.blackout.prewarning.ui.theme.ZtGlass
import ua.blackout.prewarning.ui.theme.ZtShapes

/**
 * The glass card used by every block of the app: soft floating shadow, 24 dp corners, translucent
 * matte fill with a top sheen and (by default) the lit glass rim. One implementation so border,
 * radius and shadow cannot drift apart between screens; [glassSurface] gives the same look to
 * surfaces that are not a GlassCard (About blocks, bottom navigation).
 */
@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    shape: Shape = ZtShapes.Card,
    cornerRadius: Dp = 24.dp,
    background: Color = ZtColors.Card,
    borderColor: Color? = ZtColors.CardBorder,
    contentPadding: PaddingValues = PaddingValues(16.dp),
    content: @Composable () -> Unit
) {
    Box(
        modifier = modifier
            .glassSurface(shape, cornerRadius, background, rim = false)
            .then(
                when (borderColor) {
                    null -> Modifier
                    // the default border is the lit glass rim; a custom colour (warning cards) stays solid
                    ZtColors.CardBorder -> Modifier.border(1.dp, ZtGlass.Rim, shape)
                    else -> Modifier.border(1.dp, borderColor, shape)
                }
            )
            .padding(contentPadding)
    ) {
        content()
    }
}

/** Liquid-glass surface: soft shadow, translucent fill, matte top sheen and (when [rim]) the lit rim. */
fun Modifier.glassSurface(
    shape: Shape,
    cornerRadius: Dp,
    background: Color = ZtColors.Card,
    rim: Boolean = true
): Modifier = this
    .floatingShadow(color = ZtGlass.Shadow, borderRadius = cornerRadius)
    .clip(shape)
    .background(background)
    .background(ZtGlass.Sheen)
    .then(if (rim) Modifier.border(1.dp, ZtGlass.Rim, shape) else Modifier)
