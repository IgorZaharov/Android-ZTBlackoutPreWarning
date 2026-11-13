package ua.blackout.prewarning.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import ua.blackout.prewarning.ui.theme.ZtColors
import ua.blackout.prewarning.ui.theme.ZtShapes

/**
 * The frosted dark card used by every block of the app: floating shadow, 24 dp corners, 75 % dark
 * glass and (by default) the 1 dp light border. One implementation so border, radius and shadow
 * cannot drift apart between screens.
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
            .floatingShadow(color = Color(0xB3000000), borderRadius = cornerRadius, blurRadius = 22.dp, offsetY = 8.dp)
            .shadow(10.dp, shape, ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
            .clip(shape)
            .background(background)
            .then(if (borderColor != null) Modifier.border(1.dp, borderColor, shape) else Modifier)
            .padding(contentPadding)
    ) {
        content()
    }
}
