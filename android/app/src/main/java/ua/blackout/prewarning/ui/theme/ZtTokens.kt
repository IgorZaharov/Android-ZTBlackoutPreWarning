package ua.blackout.prewarning.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineBreak
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Design tokens of the app. Values are the ones the screens already used (so the original look is
 * kept), gathered in one place; `spec/design-tokens.json` mirrors them for the web simulator and iOS.
 *
 * Type scale (docs/review/TYPOGRAPHY.md): no text below 12 sp, labels 14 sp, body 16 sp, and wrapping
 * text keeps a line height of at least 1.4x. Hero and title sizes are unchanged.
 */
object ZtType {
    /** Hero countdown. */
    val display = TextStyle(fontSize = 44.sp, lineHeight = 48.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace)
    /** "Черга 5.2". */
    val title = TextStyle(fontSize = 24.sp, lineHeight = 30.sp, fontWeight = FontWeight.Bold, lineBreak = LineBreak.Heading)
    /** Screen and modal titles. */
    val heading = TextStyle(fontSize = 20.sp, lineHeight = 28.sp, fontWeight = FontWeight.ExtraBold, lineBreak = LineBreak.Heading)
    /** Card titles, field values, banner titles. */
    val subhead = TextStyle(fontSize = 16.sp, lineHeight = 23.sp, fontWeight = FontWeight.Bold, lineBreak = LineBreak.Heading)
    /** Toggle labels, step text, descriptions. */
    val body = TextStyle(fontSize = 16.sp, lineHeight = 24.sp, fontWeight = FontWeight.Medium, lineBreak = LineBreak.Paragraph)
    /** Field labels, buttons, tabs, chips. */
    val label = TextStyle(fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold)
    /** Addresses, last-updated lines, durations, hints. */
    val caption = TextStyle(fontSize = 13.sp, lineHeight = 19.sp, fontWeight = FontWeight.Medium, lineBreak = LineBreak.Paragraph)
    /** Upper-case section headings and drum ticks; tracking 0.05 em. */
    val overline = TextStyle(fontSize = 12.sp, lineHeight = 17.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.6.sp)
    /** Times in the outage list. */
    val timeMono = TextStyle(fontSize = 16.sp, lineHeight = 22.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
    /** Durations and small figures. */
    val captionMono = TextStyle(fontSize = 13.sp, lineHeight = 19.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
}

object ZtColors {
    val Accent = Color(0xFFFF5E3A)
    /** Translucent card fill (64 %); the glass look adds [ZtGlass] on top. */
    val Card = Color(0xA3141A29)
    val CardSolid = Color(0xFF141A29)
    val CardBorder = Color(0x26FFFFFF)
    val InnerRow = Color(0x14FFFFFF)
    val InputBorder = Color(0x33FFFFFF)
    val Divider = Color(0x1AFFFFFF)
    val TextPrimary = Color.White
    val TextSecondary = Color(0xB3BAE6FD)
    val TextTertiary = Color(0x99BAE6FD)

    // Status chips (same family the About screen uses) plus a grey for "no data"
    val ChipGreen = Color(0x3310B981)
    val ChipGreenText = Color(0xFF34D399)
    val ChipAmber = Color(0x33F59E0B)
    val ChipAmberText = Color(0xFFFBBF24)
    val ChipRed = Color(0x33EF4444)
    val ChipRedText = Color(0xFFF87171)
    val ChipGrey = Color(0x339CA3AF)
    val ChipGreyText = Color(0xFF9CA3AF)

    // Emergency overlay on the drum: amber stripes over the crimson planned block (see spec/UI_DRUM.md)
    val EmergencyAmberStart = Color(0xFFFFB020)
    val EmergencyAmberMid = Color(0xFFF28A1B)
    val EmergencyAmberEnd = Color(0xFFC96A0B)
    val EmergencyStripeDark = Color(0x8C1A1208)
    val EmergencyStripeLight = Color(0xD9FFB020)
}

/**
 * Liquid-glass card surface (spec/design-tokens.json "glass"): a matte sheen that fades from the top, a rim
 * that is lit at the top and fades towards the bottom, and a soft short shadow.
 */
object ZtGlass {
    val Sheen = Brush.verticalGradient(listOf(Color(0x1AFFFFFF), Color(0x05FFFFFF)))
    val Rim = Brush.verticalGradient(listOf(Color(0x40FFFFFF), Color(0x14FFFFFF)))
    val Shadow = Color(0x40000000)
}

object ZtShapes {
    val Card = RoundedCornerShape(24.dp)
    val Control = RoundedCornerShape(16.dp)
    val Row = RoundedCornerShape(14.dp)
    val Chip = RoundedCornerShape(12.dp)
    val Badge = RoundedCornerShape(10.dp)
}

/** Minimum touch target (Material guideline), used with `minimumInteractiveComponentSize()` or `heightIn`. */
val ZtMinTouch = 48.dp
